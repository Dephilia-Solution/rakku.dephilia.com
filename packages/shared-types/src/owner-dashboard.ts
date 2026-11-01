import { jakartaDateKey, jakartaDayStart, jakartaRangeBounds } from "./reporting";

export type OwnerDashboardRange = "today" | "week" | "month";
export type OwnerDashboardPaymentMethod = "cash" | "card" | "qris" | "later" | "unknown";

export interface OwnerDashboardQuery {
  range?: OwnerDashboardRange;
  /** Omit or use "all" for all company outlets. */
  outletId?: string;
}

export interface OwnerDashboardPeriod {
  /** UTC ISO instants; all intervals are [start, end), grouped by Jakarta date. */
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  label: string;
  /** Inclusive plan-history cutoff, or null for unlimited history. */
  historyStart: string | null;
  /** False when the equal-length prior interval crosses the history cutoff. */
  previousAvailable: boolean;
}

export interface OwnerDashboardSummary {
  /** Completed orders' total_price: after discounts, including tax. */
  revenue: number;
  transactions: number;
  averageOrder: number;
  /** Null means unavailable under the history cap, not zero sales. */
  previousRevenue: number | null;
  previousTransactions: number | null;
  previousAverageOrder: number | null;
  /** Percent changes, unrounded; null for unavailable/zero prior values. */
  changePercent: { revenue: number | null; transactions: number | null; averageOrder: number | null };
}

export interface OwnerDashboardAnalytics {
  range: OwnerDashboardRange;
  outletId: string;
  period: OwnerDashboardPeriod;
  summary: OwnerDashboardSummary;
  trend: { date: string; revenue: number; transactions: number }[];
  /** Top five by units, then item revenue, then snapshot name. Item subtotals
   * include product discounts/modifiers, but exclude order-level discounts/tax.
   * Historical snapshot names are grouped even if the catalog product is gone. */
  topProducts: { name: string; quantity: number; revenue: number }[];
  /** One row per selected outlet, including outlets without sales. Status is
   * administrative, never an online/presence indicator. lastOrderAt is the
   * latest completed order's created_at WITHIN the selected period. */
  outlets: { id: string; name: string; status: "active" | "inactive"; revenue: number; transactions: number; lastOrderAt: string | null }[];
  outletCounts: { total: number; active: number; inactive: number };
  /** Whole order totals classified ONLY by the order's primary payment method;
   * these are not tender receipts or split-payment allocations. */
  payments: { method: OwnerDashboardPaymentMethod; revenue: number; transactions: number }[];
  /** Current active ingredients at/below minimum, independent of the range.
   * At most 20 rows, largest unit-relative shortfall first. */
  lowStock: { id: string; name: string; outletId: string; outletName: string; unit: string; quantity: number; minimum: number }[];
  lowStockTotal: number;
  /** Selected-period purchase_date totals; null without inventory_advanced. */
  purchases: { count: number; total: number } | null;
  generatedAt: string;
}

export const OWNER_DASHBOARD_LOW_STOCK_LIMIT = 20;
const DAY_MS = 86_400_000;

export function isOwnerDashboardRange(value: unknown): value is OwnerDashboardRange {
  return value === "today" || value === "week" || value === "month";
}

/** Today = one Jakarta date; week = trailing seven dates including today;
 * month = calendar month-to-date including today. End is tomorrow at 00:00,
 * not the current instant. Prior is the immediately preceding same number of
 * calendar days (not necessarily the previous calendar month). A history cap
 * clips current start, then recomputes that equal-length prior interval.
 * Unavailable prior intervals must not be queried or presented as zero. */
export function ownerDashboardPeriod(range: OwnerDashboardRange, now: Date, historyDays = -1): OwnerDashboardPeriod {
  if (!isOwnerDashboardRange(range) || !Number.isFinite(now.getTime())) throw new Error("Invalid dashboard range or time");
  if (!Number.isSafeInteger(historyDays) || historyDays < -1) throw new Error("Invalid dashboard history limit");
  const bounds = jakartaRangeBounds(range, now);
  const historyStart = historyDays < 0 ? null : new Date(jakartaDayStart(now).getTime() - Math.max(0, historyDays - 1) * DAY_MS).toISOString();
  const start = historyStart && historyStart > bounds.start! ? historyStart : bounds.start!;
  const end = bounds.end!;
  const previousStart = new Date(Date.parse(start) - (Date.parse(end) - Date.parse(start))).toISOString();
  return {
    start, end, previousStart, previousEnd: start,
    label: range === "today" ? "Hari ini" : range === "week" ? "7 hari terakhir" : "Bulan ini",
    historyStart, previousAvailable: historyStart === null || previousStart >= historyStart,
  };
}

/** Complete, ascending Jakarta date keys, including days without orders. */
export function ownerDashboardDates(period: OwnerDashboardPeriod): string[] {
  const dates: string[] = [];
  for (let at = Date.parse(period.start); at < Date.parse(period.end); at += DAY_MS) dates.push(jakartaDateKey(new Date(at)));
  return dates;
}

export function ownerDashboardSummary(revenue: number, transactions: number, previous: { revenue: number; transactions: number } | null): OwnerDashboardSummary {
  const averageOrder = transactions ? revenue / transactions : 0;
  const previousAverageOrder = previous ? (previous.transactions ? previous.revenue / previous.transactions : 0) : null;
  const change = (current: number, prior: number | null) => prior === null || prior === 0 ? null : (current - prior) / prior * 100;
  return {
    revenue, transactions, averageOrder,
    previousRevenue: previous?.revenue ?? null, previousTransactions: previous?.transactions ?? null, previousAverageOrder,
    changePercent: { revenue: change(revenue, previous?.revenue ?? null), transactions: change(transactions, previous?.transactions ?? null), averageOrder: change(averageOrder, previousAverageOrder) },
  };
}
