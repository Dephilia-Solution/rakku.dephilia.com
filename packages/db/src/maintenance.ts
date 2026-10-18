import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./query";

export interface CleanupCount {
  table: string;
  eligible: number;
  deleted: number;
}

async function deleteOrCount(db: DatabaseClient, schema: string, table: string, condition: ReturnType<typeof sql>, apply: boolean): Promise<CleanupCount> {
  const target = sql`${sql.identifier(schema)}.${sql.identifier(table)}`;
  const name = `${schema}.${table}`;
  if (!apply) {
    const [row] = await db.execute(sql`select count(*)::int as count from ${target} where ${condition}`);
    return { table: name, eligible: Number(row?.count ?? 0), deleted: 0 };
  }
  const rows = await db.execute(sql`delete from ${target} where ${condition} returning *`);
  return { table: name, eligible: rows.length, deleted: rows.length };
}

export async function cleanupExpiredSessions(db: DatabaseClient, before: Date, apply = false): Promise<CleanupCount> {
  return deleteOrCount(db, "app_private", "auth_sessions",
    sql`(expires_at < ${before.toISOString()} or (revoked_at is not null and revoked_at < ${before.toISOString()}))`, apply);
}

export async function cleanupExpiredRateLimits(db: DatabaseClient, before: Date, apply = false): Promise<CleanupCount> {
  return deleteOrCount(db, "app_private", "auth_rate_limits", sql`expires_at < ${before.toISOString()}`, apply);
}

export async function cleanupDoneJobs(db: DatabaseClient, before: Date, apply = false): Promise<CleanupCount> {
  return deleteOrCount(db, "app_private", "job_queue",
    sql`state = 'done' and finished_at is not null and finished_at < ${before.toISOString()}`, apply);
}

export async function cleanupProcessedProviderEvents(db: DatabaseClient, before: Date, apply = false): Promise<CleanupCount> {
  if (!apply) {
    const [row] = await db.execute(sql`select count(*)::int as count from app_private.provider_events e
      where processed_at is not null and processed_at < ${before.toISOString()}
      and not exists (select 1 from app_private.job_queue j
        where j.kind='vessel.webhook' and j.unique_key=e.id::text
          and j.state in ('pending','leased','dead_letter'))`);
    return { table: "app_private.provider_events", eligible: Number(row?.count ?? 0), deleted: 0 };
  }
  const rows = await db.execute(sql`delete from app_private.provider_events e
    where processed_at is not null and processed_at < ${before.toISOString()}
    and not exists (select 1 from app_private.job_queue j
      where j.kind='vessel.webhook' and j.unique_key=e.id::text
        and j.state in ('pending','leased','dead_letter'))
    returning e.id`);
  return { table: "app_private.provider_events", eligible: rows.length, deleted: rows.length };
}

export interface OperationalSnapshot {
  pendingPaymentIntents: number;
  unknownPaymentIntents: number;
  pendingSubscriptionInvoices: number;
  unknownSubscriptionInvoices: number;
  unresolvedPaymentExceptions: number;
  deadLetterJobs: number;
  dueJobs: number;
  settlementDiscrepancies: number;
  pendingWithdrawals: number;
  checkoutPaused: boolean;
  alerts: string[];
}

export async function operationalSnapshot(db: DatabaseClient): Promise<OperationalSnapshot> {
  const [row] = await db.execute(sql`select
    (select count(*)::int from public.payment_intents where status='pending') as pending_payment_intents,
    (select count(*)::int from public.payment_intents where status='pending' and provider_transaction_id is null) as unknown_payment_intents,
    (select count(*)::int from public.subscription_invoices where status='pending') as pending_subscription_invoices,
    (select count(*)::int from public.subscription_invoices where provider_state='unknown') as unknown_subscription_invoices,
    (select count(*)::int from app_private.payment_reconciliation where resolved_at is null) as unresolved_payment_exceptions,
    (select count(*)::int from app_private.job_queue where state='dead_letter') as dead_letter_jobs,
    (select count(*)::int from app_private.job_queue where state in ('pending','leased') and run_at <= now()) as due_jobs,
    (select count(*)::int from public.settlement_reports where status='discrepancy') as settlement_discrepancies,
    (select count(*)::int from public.withdrawals where status in ('requested','processing')) as pending_withdrawals,
    coalesce((select enabled from app_private.runtime_flags where key='checkout_paused'), false) as checkout_paused`);
  const snapshot: OperationalSnapshot = {
    pendingPaymentIntents: Number(row.pending_payment_intents),
    unknownPaymentIntents: Number(row.unknown_payment_intents),
    pendingSubscriptionInvoices: Number(row.pending_subscription_invoices),
    unknownSubscriptionInvoices: Number(row.unknown_subscription_invoices),
    unresolvedPaymentExceptions: Number(row.unresolved_payment_exceptions),
    deadLetterJobs: Number(row.dead_letter_jobs),
    dueJobs: Number(row.due_jobs),
    settlementDiscrepancies: Number(row.settlement_discrepancies),
    pendingWithdrawals: Number(row.pending_withdrawals),
    checkoutPaused: row.checkout_paused === true,
    alerts: [],
  };
  if (snapshot.deadLetterJobs > 0) snapshot.alerts.push("dead_letter_jobs");
  if (snapshot.unresolvedPaymentExceptions > 0) snapshot.alerts.push("unresolved_payment_exceptions");
  if (snapshot.settlementDiscrepancies > 0) snapshot.alerts.push("settlement_discrepancy");
  if (snapshot.checkoutPaused) snapshot.alerts.push("checkout_paused");
  if (snapshot.unknownPaymentIntents > 0) snapshot.alerts.push("unknown_payment_creation");
  if (snapshot.unknownSubscriptionInvoices > 0) snapshot.alerts.push("unknown_subscription_invoice");
  if (snapshot.dueJobs > 100) snapshot.alerts.push("job_backlog");
  return snapshot;
}
