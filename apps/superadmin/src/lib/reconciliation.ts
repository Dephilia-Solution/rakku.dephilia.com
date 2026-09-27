import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReconciliationSummary {
  systemBalance: number;
  totalCreditedNet: number;
  totalMdr: number;
  totalWithdrawn: number;
  settlementNetTotal: number;
  cashPosition: number;
  gap: number;
}

/**
 * Hitung kredit saldo (net) pada rentang periode settlement.
 * `periodStart`/`periodEnd` format `YYYY-MM-DD` (inklusif).
 */
export async function computeExpectedNet(
  supabase: SupabaseClient,
  periodStart: string,
  periodEnd: string
): Promise<number> {
  const rangeStart = `${periodStart}T00:00:00.000Z`;
  const rangeEndDate = new Date(`${periodEnd}T00:00:00.000Z`);
  rangeEndDate.setUTCDate(rangeEndDate.getUTCDate() + 1);
  const rangeEnd = rangeEndDate.toISOString();

  const { data } = await supabase
    .from("balance_transactions")
    .select("amount")
    .eq("type", "sale_credit")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEnd);

  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

/** Ringkasan posisi dana: saldo sistem vs posisi kas. */
export async function getReconciliationSummary(
  supabase: SupabaseClient
): Promise<ReconciliationSummary> {
  const [balancesResult, ledgerResult, withdrawalsResult, reportsResult] =
    await Promise.all([
      supabase
        .from("merchant_balances")
        .select("available_balance, pending_balance"),
      supabase
        .from("balance_transactions")
        .select("type, amount, fee_amount")
        .in("type", ["sale_credit", "withdrawal"]),
      supabase
        .from("withdrawals")
        .select("amount, status")
        .eq("status", "completed"),
      supabase.from("settlement_reports").select("net_amount"),
    ]);

  const systemBalance = (balancesResult.data ?? []).reduce(
    (sum, row) =>
      sum + Number(row.available_balance) + Number(row.pending_balance),
    0
  );

  const ledger = ledgerResult.data ?? [];
  const totalCreditedNet = ledger
    .filter((row) => row.type === "sale_credit")
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const totalMdr = ledger
    .filter((row) => row.type === "sale_credit")
    .reduce((sum, row) => sum + Number(row.fee_amount), 0);

  const totalWithdrawn = (withdrawalsResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );

  const settlementNetTotal = (reportsResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.net_amount),
    0
  );

  const cashPosition = settlementNetTotal - totalWithdrawn;

  return {
    systemBalance,
    totalCreditedNet,
    totalMdr,
    totalWithdrawn,
    settlementNetTotal,
    cashPosition,
    gap: cashPosition - systemBalance,
  };
}
