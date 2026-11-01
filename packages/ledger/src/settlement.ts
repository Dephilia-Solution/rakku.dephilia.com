import { sql, type DatabaseClient } from "@rakku/db";
import { applyBalanceTransaction } from "./index";

export interface SettlementReportInput {
  provider: string;
  providerReference?: string | null;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  mdrAmount: number;
  note?: string | null;
  actor: string;
}

export interface SettlementReportResult {
  report: Record<string, unknown>;
  settled: boolean;
  expectedNet: number;
  difference: number;
  released: number;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export async function recordSettlementReport(db: DatabaseClient, input: SettlementReportInput): Promise<SettlementReportResult> {
  if (!validDate(input.periodStart) || !validDate(input.periodEnd)) throw new Error("Periode settlement tidak valid");
  if (input.periodStart > input.periodEnd) throw new Error("Tanggal mulai tidak boleh melebihi tanggal akhir");
  if (!Number.isFinite(input.grossAmount) || input.grossAmount < 0
    || !Number.isFinite(input.mdrAmount) || input.mdrAmount < 0
    || input.mdrAmount > input.grossAmount) {
    throw new Error("Nominal settlement tidak valid");
  }
  const net = Math.round((input.grossAmount - input.mdrAmount) * 100) / 100;
  const start = new Date(`${input.periodStart}T00:00:00.000Z`);
  const end = new Date(`${input.periodEnd}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return db.transaction(async tx => {
    const rows = await tx.execute(sql`select id,company_id,amount from public.balance_transactions
      where type='sale_credit' and settlement_report_id is null and settled_at is null
        and created_at >= ${start.toISOString()} and created_at < ${end.toISOString()}
      order by company_id,id for update`);
    const expected = Math.round(rows.reduce((sum, row) => sum + Number(row.amount), 0) * 100) / 100;
    const difference = Math.round((net - expected) * 100) / 100;
    const status = difference === 0 ? "matched" : "discrepancy";
    const [report] = await tx.execute(sql`insert into public.settlement_reports
      (provider,period_start,period_end,gross_amount,mdr_amount,net_amount,expected_net,difference,note,
        created_by,status,provider_reference)
      values (${input.provider},${input.periodStart},${input.periodEnd},${input.grossAmount},${input.mdrAmount},
        ${net},${expected},${difference},${input.note ?? null},${input.actor},${status},${input.providerReference ?? null})
      returning *`);
    if (!report) throw new Error("Gagal menyimpan settlement");
    if (difference !== 0) {
      return { report: report as Record<string, unknown>, settled: false, expectedNet: expected, difference, released: 0 };
    }
    const byCompany = new Map<string, number>();
    for (const row of rows) {
      const companyId = String(row.company_id);
      byCompany.set(companyId, (byCompany.get(companyId) ?? 0) + Number(row.amount));
    }
    for (const [companyId, amount] of byCompany) {
      const mutation = await applyBalanceTransaction(tx, {
        companyId, type: "settlement_credit", amount,
        pendingDelta: 0, unsettledDelta: -amount, feeAmount: 0,
        referenceType: "settlement_report", referenceId: String(report.id),
        note: `Settlement ${String(report.id)}`, createdBy: input.actor,
      });
      if (!mutation.ok) throw new Error(mutation.error ?? "Gagal melepas saldo settlement");
    }
    if (rows.length) {
      const ids = sql.join(rows.map(row => sql`${row.id}::uuid`), sql`, `);
      await tx.execute(sql`update public.balance_transactions set settlement_report_id=${String(report.id)},
        settled_at=now() where id in (${ids})`);
    }
    const [updated] = await tx.execute(sql`update public.settlement_reports set status='matched',
      settled_at=now(), settled_by=${input.actor} where id=${String(report.id)} returning *`);
    return {
      report: (updated ?? report) as Record<string, unknown>, settled: true,
      expectedNet: expected, difference, released: expected,
    };
  });
}
