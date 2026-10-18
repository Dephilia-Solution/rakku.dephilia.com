import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./query";

export interface UsageReservation {
  allowed: boolean;
  used: number;
  limit: number;
  period: string;
  kind: string;
}

export async function reserveUsage(db: DatabaseClient, input: {
  companyId: string;
  kind: string;
  amount: number;
  limit: number;
  period: string;
}): Promise<UsageReservation> {
  if (!Number.isInteger(input.amount) || input.amount < 1) throw new Error("Jumlah quota tidak valid");
  if (!Number.isInteger(input.limit)) throw new Error("Limit quota tidak valid");
  if (!input.period.trim() || input.period.length > 40 || !input.kind.trim() || input.kind.length > 80) {
    throw new Error("Periode/jenis quota tidak valid");
  }
  return db.transaction(async tx => {
    await tx.execute(sql`insert into app_private.usage_counters(company_id,period,kind,used)
      values(${input.companyId},${input.period},${input.kind},0)
      on conflict (company_id,period,kind) do nothing`);
    const [row] = await tx.execute(sql`select used from app_private.usage_counters
      where company_id=${input.companyId} and period=${input.period} and kind=${input.kind} for update`);
    const used = Number(row?.used ?? 0);
    if (input.limit >= 0 && used + input.amount > input.limit) {
      return { allowed: false, used, limit: input.limit, period: input.period, kind: input.kind };
    }
    const [updated] = await tx.execute(sql`update app_private.usage_counters set used=used+${input.amount},
      updated_at=now() where company_id=${input.companyId} and period=${input.period} and kind=${input.kind}
      returning used`);
    return { allowed: true, used: Number(updated.used), limit: input.limit, period: input.period, kind: input.kind };
  });
}

export async function releaseUsage(db: DatabaseClient, input: {
  companyId: string;
  kind: string;
  amount: number;
  period: string;
}): Promise<void> {
  if (!Number.isInteger(input.amount) || input.amount < 1) return;
  await db.execute(sql`update app_private.usage_counters set used=greatest(0,used-${input.amount}), updated_at=now()
    where company_id=${input.companyId} and period=${input.period} and kind=${input.kind}`);
}

export async function getUsageCounter(db: DatabaseClient, input: {
  companyId: string;
  kind: string;
  period: string;
}): Promise<number> {
  const [row] = await db.execute(sql`select used from app_private.usage_counters
    where company_id=${input.companyId} and period=${input.period} and kind=${input.kind}`);
  return Number(row?.used ?? 0);
}
