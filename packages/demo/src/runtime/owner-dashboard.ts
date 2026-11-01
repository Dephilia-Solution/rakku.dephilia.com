import {
  OWNER_DASHBOARD_LOW_STOCK_LIMIT, ownerDashboardDates, ownerDashboardPeriod, ownerDashboardSummary,
  type OwnerDashboardAnalytics, type OwnerDashboardPaymentMethod, type OwnerDashboardQuery,
} from "../../../shared-types/src/owner-dashboard";
import { jakartaDateKey } from "../../../shared-types/src/reporting";
import type { DemoState } from "../models";
import { fail } from "../business";

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Pure, browser-safe analytics of the current owner snapshot. Never reads a
 * provider, database, wall clock, catalog price/cost, or split tender amount. */
export function aggregateDemoOwnerDashboard(state: DemoState, query: OwnerDashboardQuery = {}): OwnerDashboardAnalytics {
  if (!state.session.authenticated || state.session.mode !== "owner") fail("Owner access required");
  const range = query.range ?? "today", outletId = query.outletId || "all";
  const plan = state.plans.find(row => row.slug === state.plan) ?? fail("Resource not found: plan");
  const period = ownerDashboardPeriod(range, new Date(state.now), plan.report_history_days);
  const start = Date.parse(period.start), end = Date.parse(period.end), previousStart = Date.parse(period.previousStart);
  const selected = state.outlets.filter(row => row.company_id === state.company.id && (outletId === "all" || row.id === outletId));
  if (outletId !== "all" && selected.length === 0) fail("Resource not found: outlet");
  const outlets = selected.map<OwnerDashboardAnalytics["outlets"][number]>(row => ({
    id: row.id, name: row.name, status: row.is_active ? "active" : "inactive", revenue: 0, transactions: 0, lastOrderAt: null,
  })).sort((a, b) => compare(a.name, b.name) || compare(a.id, b.id));
  const byOutlet = new Map(outlets.map(row => [row.id, row]));
  const trend = ownerDashboardDates(period).map(date => ({ date, revenue: 0, transactions: 0 }));
  const byDay = new Map(trend.map(row => [row.date, row]));
  const products = new Map<string, OwnerDashboardAnalytics["topProducts"][number]>();
  const payments = new Map<OwnerDashboardPaymentMethod, OwnerDashboardAnalytics["payments"][number]>();
  let revenue = 0, transactions = 0, previousRevenue = 0, previousTransactions = 0;
  for (const order of state.orders) {
    const outlet = byOutlet.get(order.outlet_id), at = Date.parse(order.created_at);
    if (!outlet || order.company_id !== state.company.id || order.status !== "completed" || !Number.isFinite(at) || at >= end) continue;
    if (at < start) {
      if (period.previousAvailable && at >= previousStart) { previousRevenue += order.total_price; previousTransactions++; }
      continue;
    }
    revenue += order.total_price; transactions++;
    outlet.revenue += order.total_price; outlet.transactions++;
    if (!outlet.lastOrderAt || at > Date.parse(outlet.lastOrderAt)) outlet.lastOrderAt = new Date(at).toISOString();
    const day = byDay.get(jakartaDateKey(order.created_at))!;
    day.revenue += order.total_price; day.transactions++;
    const rawMethod = order.payment_method === "qris_manual" ? "qris" : order.payment_method;
    const method: OwnerDashboardPaymentMethod = rawMethod === "cash" || rawMethod === "card" || rawMethod === "qris" || rawMethod === "later" ? rawMethod : "unknown";
    const payment = payments.get(method) ?? { method, revenue: 0, transactions: 0 };
    payment.revenue += order.total_price; payment.transactions++; payments.set(method, payment);
    for (const item of order.items) {
      const product = products.get(item.product_name) ?? { name: item.product_name, quantity: 0, revenue: 0 };
      product.quantity += item.quantity; product.revenue += item.subtotal; products.set(item.product_name, product);
    }
  }
  const lowStock = state.ingredients.filter(row => row.company_id === state.company.id && byOutlet.has(row.outlet_id) && row.is_active && row.stock_quantity <= row.min_stock_alert)
    .map(row => ({ id: row.id, name: row.name, outletId: row.outlet_id, outletName: byOutlet.get(row.outlet_id)!.name, unit: row.unit, quantity: row.stock_quantity, minimum: row.min_stock_alert }));
  const shortfall = (row: typeof lowStock[number]) => row.minimum > 0 ? (row.minimum - row.quantity) / row.minimum : 0;
  lowStock.sort((a, b) => shortfall(b) - shortfall(a) || compare(a.name, b.name) || compare(a.id, b.id));
  const purchases = plan.features.inventory_advanced ? { count: 0, total: 0 } : null;
  if (purchases) for (const purchase of state.purchases) {
    // Demo purchase_date is a Jakarta calendar date; production stores an instant.
    const at = Date.parse(purchase.purchase_date.length === 10 ? `${purchase.purchase_date}T00:00:00+07:00` : purchase.purchase_date);
    if (purchase.company_id === state.company.id && byOutlet.has(purchase.outlet_id) && at >= start && at < end) {
      purchases.count++; purchases.total += purchase.total_amount;
    }
  }
  const active = outlets.filter(row => row.status === "active").length;
  return {
    range, outletId, period, summary: ownerDashboardSummary(revenue, transactions, period.previousAvailable ? { revenue: previousRevenue, transactions: previousTransactions } : null),
    trend, topProducts: [...products.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || compare(a.name, b.name)).slice(0, 5),
    outlets, outletCounts: { total: outlets.length, active, inactive: outlets.length - active },
    payments: [...payments.values()].sort((a, b) => b.revenue - a.revenue || compare(a.method, b.method)),
    lowStock: lowStock.slice(0, OWNER_DASHBOARD_LOW_STOCK_LIMIT), lowStockTotal: lowStock.length, purchases, generatedAt: new Date(state.now).toISOString(),
  };
}
