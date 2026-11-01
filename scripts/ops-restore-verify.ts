import { config } from "dotenv";
import { closeDatabase, createAdminClient, sql } from "@rakku/db";

config({ path: process.env.NEON_ENV_FILE || ".env.local" });

async function main() {
  const db = createAdminClient();
  try {
    const [migrations] = await db.execute(sql`select count(*)::int as count from rakku_migrations.history`);
    const bucketMismatch = await db.execute(sql`select b.company_id,
      b.available_balance,
      b.pending_balance,
      b.unsettled_balance,
      coalesce(sum(t.amount) filter (where t.type <> 'sale_credit'), 0)
        + coalesce(sum(t.amount) filter (where t.type='sale_credit'
          and t.settlement_report_id is null and t.settled_at is not null), 0) as ledger_available,
      coalesce(sum(t.pending_delta), 0) as ledger_pending,
      coalesce(sum(t.unsettled_delta), 0) as ledger_unsettled
      from public.merchant_balances b
      left join public.balance_transactions t on t.company_id=b.company_id
      group by b.company_id,b.available_balance,b.pending_balance,b.unsettled_balance
      having abs(b.available_balance - (coalesce(sum(t.amount) filter (where t.type <> 'sale_credit'), 0)
          + coalesce(sum(t.amount) filter (where t.type='sale_credit'
            and t.settlement_report_id is null and t.settled_at is not null), 0))) > 0.01
        or abs(b.pending_balance - coalesce(sum(t.pending_delta), 0)) > 0.01
        or abs(b.unsettled_balance - coalesce(sum(t.unsettled_delta), 0)) > 0.01`);
    const negative = await db.execute(sql`select company_id from public.merchant_balances
      where available_balance < 0 or pending_balance < 0 or unsettled_balance < 0`);
    const [exceptions] = await db.execute(sql`select count(*)::int as count from app_private.payment_reconciliation where resolved_at is null`);
    const [deadLetters] = await db.execute(sql`select count(*)::int as count from app_private.job_queue where state='dead_letter'`);
    const result = {
      migrations: Number(migrations.count),
      bucket_mismatches: bucketMismatch,
      negative_balances: negative,
      unresolved_payment_exceptions: Number(exceptions.count),
      dead_letter_jobs: Number(deadLetters.count),
    };
    console.log(JSON.stringify(result, null, 2));
    if (bucketMismatch.length || negative.length) process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Restore verification failed");
  process.exitCode = 1;
});
