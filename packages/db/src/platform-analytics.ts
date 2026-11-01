import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./query";

/** Platform-only caller. Return aggregate scalars and a bounded 14-day series. */
export async function readPlatformPaymentAnalytics(db: DatabaseClient, input: { monthStart: string; since: string; end: string }) {
  const [row] = await db.execute(sql`
    with credits as (
      select coalesce(sum(amount + fee_amount),0) as gross, coalesce(sum(fee_amount),0) as fees,
        coalesce(sum(amount + fee_amount) filter (where created_at>=${input.monthStart}::timestamptz),0) as month_gross,
        coalesce(sum(fee_amount) filter (where created_at>=${input.monthStart}::timestamptz),0) as month_fees
      from public.balance_transactions where type='sale_credit'
    ), intents as (
      select count(*) as total, count(*) filter (where paid_at>=${input.monthStart}::timestamptz) as month_total
      from public.payment_intents where status='success'
    ), balances as (
      select coalesce(sum(available_balance),0) as available, coalesce(sum(pending_balance),0) as pending from public.merchant_balances
    ), withdrawals as (
      select coalesce(sum(amount) filter (where status='completed'),0) as total,
        count(*) filter (where status in ('requested','processing')) as pending from public.withdrawals
    ), daily as (
      select (paid_at at time zone 'Asia/Jakarta')::date as day, sum(amount) as gross, count(*) as count
      from public.payment_intents where status='success' and paid_at>=${input.since}::timestamptz and paid_at<${input.end}::timestamptz
      group by 1
    ), calendar as (
      select (day at time zone 'Asia/Jakarta')::date as day from generate_series(
        ${input.since}::timestamptz, ${input.end}::timestamptz - interval '1 day', interval '1 day') day
    )
    select jsonb_build_object(
      'totals', jsonb_build_object('qrisCount', i.total, 'qrisGross', c.gross, 'mdr', c.fees,
        'saldoAvailable', b.available, 'saldoPending', b.pending, 'withdrawnTotal', w.total, 'withdrawalPending', w.pending),
      'month', jsonb_build_object('qrisCount', i.month_total, 'qrisGross', c.month_gross, 'mdr', c.month_fees),
      'daily', (select coalesce(jsonb_agg(jsonb_build_object('date', k.day, 'gross', coalesce(d.gross,0), 'count', coalesce(d.count,0)) order by k.day), '[]'::jsonb)
        from calendar k left join daily d on d.day=k.day)
    ) as data from credits c cross join intents i cross join balances b cross join withdrawals w`);
  return row.data;
}

/** Totals must cover the database, not just the most recent invoice/log page. */
export async function readPlatformSubscriptionAnalytics(db: DatabaseClient, input: { monthStart: string; thirtyDaysAgo: string }) {
  const [row] = await db.execute(sql`
    with paid as materialized (
      select company_id, amount, paid_at from public.subscription_invoices where status='success' and paid_at is not null
    ), log_companies as (
      select company_id, bool_or(type='trial_started') as trial, bool_or(type in ('limit_80','limit_100')) as hit_limit
      from public.notification_logs where type in ('trial_started','limit_80','limit_100') group by company_id
    ), conversions as (
      select count(*) filter (where trial) as trial_started,
        count(*) filter (where trial and exists (select 1 from paid p where p.company_id=l.company_id)) as trial_converted,
        count(*) filter (where hit_limit) as limit_hit,
        count(*) filter (where hit_limit and exists (select 1 from paid p where p.company_id=l.company_id)) as limit_converted
      from log_companies l
    ), distribution as (
      select coalesce(p.slug,'none') as slug, count(*) as count from public.companies c
      left join public.plans p on p.id=c.plan_id group by p.slug
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'paidThisMonth', (select coalesce(sum(amount),0) from paid where paid_at>=${input.monthStart}::timestamptz),
        'activeSubscriptions', (select count(*) from public.companies where subscription_status='active'),
        'trialCompanies', (select count(*) from public.companies where subscription_status='trial'),
        'pendingInvoices', (select count(*) from public.subscription_invoices where status='pending')),
      'analytics', jsonb_build_object(
        'planDistribution', (select coalesce(jsonb_object_agg(slug,count),'{}'::jsonb) from distribution),
        'trialStarted', trial_started, 'trialConverted', trial_converted, 'limitHit', limit_hit, 'limitConverted', limit_converted,
        'revenueLast30Days', (select coalesce(sum(amount),0) from paid where paid_at>=${input.thirtyDaysAgo}::timestamptz))
    ) as data from conversions`);
  return row.data;
}
