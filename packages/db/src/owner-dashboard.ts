import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./query";
import {
  OWNER_DASHBOARD_LOW_STOCK_LIMIT, ownerDashboardPeriod, ownerDashboardSummary,
  type OwnerDashboardAnalytics, type OwnerDashboardQuery,
} from "../../shared-types/src/owner-dashboard";

export interface OwnerOutletStats {
  id: string;
  name: string;
  address: string | null;
  status: "active" | "inactive";
  created_at: string;
  qr_menu_slug: string | null;
  employee_count: number;
  products_count: number;
  tables_count: number;
  categories_count: number;
}

/** Return one small row per outlet, not every product/assignment just to count it. */
export async function readOwnerOutletStats(db: DatabaseClient, companyId: string): Promise<OwnerOutletStats[]> {
  const rows = await db.execute(sql`
    select jsonb_build_object(
      'id', o.id, 'name', o.name, 'address', o.address, 'status', o.status,
      'created_at', o.created_at, 'qr_menu_slug', o.qr_menu_slug,
      'employee_count',
        (select count(distinct u.id) from public.user_outlets uo join public.users u on u.id=uo.user_id
          where uo.outlet_id=o.id and u.company_id=${companyId} and u.status='active' and not coalesce(u.all_outlets,false))
        + (select count(*) from public.users u where u.company_id=${companyId} and u.status='active' and u.all_outlets),
      'products_count', (select count(*) from public.products p where p.company_id=${companyId} and p.outlet_id=o.id),
      'tables_count', (select count(*) from public.dining_tables t where t.company_id=${companyId} and t.outlet_id=o.id),
      'categories_count', (select count(*) from public.categories c where c.company_id=${companyId} and c.outlet_id=o.id)
    ) as data
    from public.outlets o where o.company_id=${companyId} order by o.created_at, o.id`);
  return rows.map(row => row.data as OwnerOutletStats);
}

export async function readOwnerSalesTotals(db: DatabaseClient, companyId: string) {
  const [row] = await db.execute(sql`
    select count(*) as transactions, coalesce(sum(r.total_price), 0) as revenue
    from public.orders r join public.outlets o on o.id=r.outlet_id and o.company_id=${companyId}
    where r.company_id=${companyId} and r.status='completed'`);
  return { totalTransactions: Number(row?.transactions ?? 0), totalRevenue: Number(row?.revenue ?? 0) };
}

/** Aggregate the full selected period while returning at most one page of detail rows. */
export async function readOwnerSalesReport(db: DatabaseClient, input: {
  companyId: string; outletId?: string; start: string | null; end: string | null; page: number;
}) {
  if (!Number.isSafeInteger(input.page) || input.page < 1) throw new Error("Invalid report page");
  const pageSize = 50;
  const [row] = await db.execute(sql`
    with filtered as materialized (
      select r.id, r.order_number, r.total_price, r.created_at, r.payment_method, o.name as outlet_name
      from public.orders r join public.outlets o on o.id=r.outlet_id and o.company_id=${input.companyId}
      where r.company_id=${input.companyId} and r.status='completed'
        ${input.outletId ? sql`and r.outlet_id=${input.outletId}` : sql``}
        ${input.start ? sql`and r.created_at>=${input.start}::timestamptz` : sql``}
        ${input.end ? sql`and r.created_at<${input.end}::timestamptz` : sql``}
    ), page as (
      select f.*, (select count(*) from public.order_items i where i.order_id=f.id) as item_count
      from filtered f order by f.created_at desc, f.id desc limit ${pageSize} offset ${(input.page - 1) * pageSize}
    )
    select (select count(*) from filtered) as transactions,
      (select coalesce(sum(total_price),0) from filtered) as revenue,
      (select jsonb_build_object('name', i.product_name, 'count', sum(i.quantity))
        from public.order_items i join filtered f on f.id=i.order_id
        group by i.product_name order by sum(i.quantity) desc, i.product_name limit 1) as top_item,
      (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id desc), '[]'::jsonb) from page p) as orders`);
  return {
    orders: row?.orders ?? [],
    summary: { totalTransactions: Number(row?.transactions ?? 0), totalRevenue: Number(row?.revenue ?? 0), topItem: row?.top_item ?? null },
    page: input.page, pageSize,
  };
}

export interface ReadOwnerDashboardAnalyticsInput extends OwnerDashboardQuery {
  companyId: string;
  inventoryAdvanced: boolean;
  /** Effective subscription report_history_days; -1 means unlimited. */
  reportHistoryDays: number;
  now?: Date;
}

/** Auth is resolved by the caller. All relations are explicitly company/outlet
 * scoped even with the admin client's existing platform RLS context. Only
 * aggregates cross the SQL boundary: <=31 trend days, 5 products, 5 payment
 * classes, 20 ingredients and one compact row per selected outlet. */
export async function readOwnerDashboardAnalytics(db: DatabaseClient, input: ReadOwnerDashboardAnalyticsInput): Promise<OwnerDashboardAnalytics> {
  const now = input.now ?? new Date(), range = input.range ?? "today";
  const period = ownerDashboardPeriod(range, now, input.reportHistoryDays);
  const outletId = !input.outletId || input.outletId === "all" ? undefined : input.outletId;
  const [row] = await db.execute(sql`
    with selected_outlets as materialized (
      select o.id, o.name, o.status from public.outlets o
      where o.company_id=${input.companyId} ${outletId ? sql`and o.id=${outletId}::uuid` : sql``}
    ), orders_in_bounds as materialized (
      select r.id, r.outlet_id, r.created_at, r.total_price,
        case when r.payment_method in ('cash','card','qris','later') then r.payment_method else 'unknown' end as method
      from public.orders r join selected_outlets o on o.id=r.outlet_id
      where r.company_id=${input.companyId} and r.status='completed'
        and r.created_at>=${period.previousAvailable ? period.previousStart : period.start}::timestamptz
        and r.created_at<${period.end}::timestamptz
    ), current_orders as materialized (
      select id, outlet_id, created_at, total_price, method from orders_in_bounds where created_at>=${period.start}::timestamptz
    ), daily as (
      select (created_at at time zone 'Asia/Jakarta')::date as day, sum(total_price) as revenue, count(*) as transactions
      from current_orders group by 1
    ), days as (
      select generate_series((${period.start}::timestamptz at time zone 'Asia/Jakarta')::date,
        (${period.end}::timestamptz at time zone 'Asia/Jakarta')::date - 1, interval '1 day')::date as day
    ), top_products as (
      select i.product_name as name, sum(i.quantity) as quantity, sum(i.subtotal) as revenue
      from public.order_items i join current_orders r on r.id=i.order_id
      group by i.product_name order by quantity desc, revenue desc, i.product_name collate "C" limit 5
    ), outlet_sales as (
      select outlet_id, sum(total_price) as revenue, count(*) as transactions, max(created_at) as last_order_at
      from current_orders group by outlet_id
    ), payment_totals as (
      select method, sum(total_price) as revenue, count(*) as transactions from current_orders group by method
    ), low_stock as materialized (
      select i.id, i.name, i.outlet_id as "outletId", o.name as "outletName", i.unit,
        i.stock_quantity as quantity, i.min_stock_alert as minimum,
        case when i.min_stock_alert>0 then (i.min_stock_alert-i.stock_quantity)/i.min_stock_alert else 0 end as shortfall
      from public.ingredients i join selected_outlets o on o.id=i.outlet_id
      where i.company_id=${input.companyId} and i.is_active and i.stock_quantity<=i.min_stock_alert
    ), low_stock_page as (
      select id, name, "outletId", "outletName", unit, quantity, minimum from low_stock
      order by shortfall desc, name collate "C", id limit ${OWNER_DASHBOARD_LOW_STOCK_LIMIT}
    )
    select
      (not ${Boolean(outletId)} or exists(select 1 from selected_outlets)) as valid_outlet,
      (select coalesce(sum(total_price),0) from current_orders) as revenue,
      (select count(*) from current_orders) as transactions,
      (select coalesce(sum(total_price),0) from orders_in_bounds where created_at<${period.start}::timestamptz) as previous_revenue,
      (select count(*) from orders_in_bounds where created_at<${period.start}::timestamptz) as previous_transactions,
      (select coalesce(jsonb_agg(jsonb_build_object('date',to_char(d.day,'YYYY-MM-DD'),
        'revenue',coalesce(s.revenue,0),'transactions',coalesce(s.transactions,0)) order by d.day),'[]'::jsonb)
        from days d left join daily s on s.day=d.day) as trend,
      (select coalesce(jsonb_agg(to_jsonb(p) order by p.quantity desc,p.revenue desc,p.name collate "C"),'[]'::jsonb) from top_products p) as top_products,
      (select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'status',o.status,
        'revenue',coalesce(s.revenue,0),'transactions',coalesce(s.transactions,0),'lastOrderAt',s.last_order_at)
        order by o.name collate "C",o.id),'[]'::jsonb) from selected_outlets o left join outlet_sales s on s.outlet_id=o.id) as outlets,
      (select coalesce(jsonb_agg(to_jsonb(p) order by p.revenue desc,p.method),'[]'::jsonb) from payment_totals p) as payments,
      (select coalesce(jsonb_agg(to_jsonb(p) order by l.shortfall desc,p.name collate "C",p.id),'[]'::jsonb)
        from low_stock_page p join low_stock l on l.id=p.id) as low_stock,
      (select count(*) from low_stock) as low_stock_total,
      ${input.inventoryAdvanced ? sql`(select jsonb_build_object('count',count(*),'total',coalesce(sum(p.total_amount),0))
        from public.ingredient_purchases p join selected_outlets o on o.id=p.outlet_id
        where p.company_id=${input.companyId} and p.purchase_date>=${period.start}::timestamptz and p.purchase_date<${period.end}::timestamptz)` : sql`null::jsonb`} as purchases
  `);
  if (!row?.valid_outlet) throw new Error("Dashboard outlet not found");
  const outlets = (row.outlets as OwnerDashboardAnalytics["outlets"]).map(outlet => ({
    ...outlet, lastOrderAt: outlet.lastOrderAt ? new Date(outlet.lastOrderAt).toISOString() : null,
  }));
  const active = outlets.filter(outlet => outlet.status === "active").length;
  return {
    range, outletId: outletId ?? "all", period,
    summary: ownerDashboardSummary(Number(row.revenue), Number(row.transactions), period.previousAvailable
      ? { revenue: Number(row.previous_revenue), transactions: Number(row.previous_transactions) } : null),
    trend: row.trend as OwnerDashboardAnalytics["trend"], topProducts: row.top_products as OwnerDashboardAnalytics["topProducts"], outlets,
    outletCounts: { total: outlets.length, active, inactive: outlets.length - active },
    payments: row.payments as OwnerDashboardAnalytics["payments"], lowStock: row.low_stock as OwnerDashboardAnalytics["lowStock"],
    lowStockTotal: Number(row.low_stock_total), purchases: row.purchases as OwnerDashboardAnalytics["purchases"], generatedAt: now.toISOString(),
  };
}
