import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerDashboardDates, ownerDashboardPeriod, ownerDashboardSummary, type OwnerDashboardAnalytics } from "../../shared-types/src/owner-dashboard";
import { createDemoSandbox, DEMO_IDS } from "../index";
import { aggregateDemoOwnerDashboard, createDemoRequestAdapter, getDemoOwnerDashboardAnalytics } from "./runtime";
import { clone } from "./business";
import type { DemoOrder, DemoState } from "./models";

const NOW = new Date("2026-10-12T05:00:00Z"), P = DEMO_IDS.pusat, T = DEMO_IDS.taman;
function owner() { const sandbox = createDemoSandbox(NOW); sandbox.run({ type: "session.owner" }); return sandbox; }

test("dashboard periods are Jakarta half-open calendar dates with equal-length adjacent comparisons", () => {
  const now = new Date("2028-02-29T17:00:00Z"); // March 1 in Jakarta, still February in UTC.
  for (const range of ["today", "week", "month"] as const) {
    const period = ownerDashboardPeriod(range, now);
    assert.equal(period.end, "2028-03-01T17:00:00.000Z");
    assert.equal(period.previousEnd, period.start);
    assert.equal(Date.parse(period.end) - Date.parse(period.start), Date.parse(period.previousEnd) - Date.parse(period.previousStart));
    assert.equal(period.previousAvailable, true);
  }
  assert.equal(ownerDashboardPeriod("week", now).start, "2028-02-23T17:00:00.000Z");
  assert.equal(ownerDashboardPeriod("month", now).start, "2028-02-29T17:00:00.000Z");
  const leap = ownerDashboardPeriod("month", new Date("2028-02-29T16:59:59.999Z"));
  assert.equal(ownerDashboardDates(leap).length, 29); assert.equal(leap.previousStart, "2028-01-02T17:00:00.000Z");
  assert.equal(ownerDashboardPeriod("month", new Date("2027-01-01T00:00:00Z")).previousStart, "2026-12-30T17:00:00.000Z");
  assert.equal(ownerDashboardPeriod("today", NOW, 1).previousAvailable, false);
  assert.equal(ownerDashboardPeriod("today", NOW, 2).previousAvailable, true);
  assert.throws(() => ownerDashboardPeriod("all" as "today", NOW), /Invalid/);
  assert.throws(() => ownerDashboardPeriod("today", new Date("invalid")), /Invalid/);
  assert.throws(() => ownerDashboardPeriod("today", NOW, 1.5), /Invalid/);
  assert.deepEqual(ownerDashboardSummary(0, 0, { revenue: 0, transactions: 0 }).changePercent, { revenue: null, transactions: null, averageOrder: null });
  assert.deepEqual(ownerDashboardSummary(200, 4, { revenue: 100, transactions: 1 }).changePercent, { revenue: 100, transactions: 300, averageOrder: -50 });
});

test("real demo fixture dashboard has four completed orders today, consistent breakdowns and no mutation", () => {
  const sandbox = owner(), before = sandbox.getSnapshot(), result = getDemoOwnerDashboardAnalytics(sandbox);
  assert.equal(before.orders.filter(row => row.status === "completed").length, 120);
  assert.equal(result.summary.transactions, 4); assert.equal(result.outlets.length, 2);
  assert.equal(result.generatedAt, before.now); assert.ok(Object.isFrozen(result));
  assert.equal(result.outlets.reduce((sum, row) => sum + row.revenue, 0), result.summary.revenue);
  assert.equal(result.payments.reduce((sum, row) => sum + row.transactions, 0), 4);
  assert.equal(result.payments.reduce((sum, row) => sum + row.revenue, 0), result.summary.revenue);
  const a = getDemoOwnerDashboardAnalytics(sandbox, { outletId: P }), b = getDemoOwnerDashboardAnalytics(sandbox, { outletId: T });
  assert.equal(a.summary.transactions, 2); assert.equal(b.summary.transactions, 2);
  assert.equal(a.summary.revenue + b.summary.revenue, result.summary.revenue);
  assert.equal(sandbox.getSnapshot(), before);
  assert.equal(getDemoOwnerDashboardAnalytics(sandbox, { range: "month" }).trend.length, 12);
});

function controlled(): DemoState {
  const state = clone(owner().getSnapshot()), template = state.orders.find(row => row.status === "completed")!;
  state.orders = [];
  const order = (id: string, created_at: string, amount: number, status: DemoOrder["status"] = "completed", outlet_id = P, company_id = state.company.id): DemoOrder => ({
    ...clone(template), id, created_at, outlet_id, company_id, status, total_price: amount, total: amount, amount_paid: 999999,
    completed_at: "2020-01-01T00:00:00Z", payment_method: "cash", splits: [{ method: "card", amount: 999999 }],
    items: [{ ...template.items[0], product_name: "Historical", quantity: 2, subtotal: amount - 10 }],
  });
  state.orders.push(order("prior", "2026-10-10T17:00:00Z", 100), order("start", "2026-10-11T17:00:00Z", 220), order("end", "2026-10-12T17:00:00Z", 9000));
  for (const status of ["draft", "pending_payment", "cancelled"] as const) state.orders.push(order(status, state.now, 9000, status));
  state.orders.push(order("foreign-company", state.now, 9000, "completed", P, "foreign"));
  state.outlets.push({ ...state.outlets[0], id: "foreign-outlet", company_id: "foreign", name: "Foreign" });
  state.orders.push(order("foreign-outlet", state.now, 9000, "completed", "foreign-outlet" as typeof P));
  state.purchases = state.purchases.slice(0, 1).flatMap(template => [
    { ...template, purchase_date: "2026-10-12", total_amount: 50 }, { ...template, id: "old", purchase_date: "2026-10-11", total_amount: 9000 },
    { ...template, id: "end", purchase_date: "2026-10-13", total_amount: 9000 }, { ...template, id: "foreign", company_id: "foreign", purchase_date: "2026-10-12", total_amount: 9000 },
  ]);
  state.ingredients = state.ingredients.slice(0, 1).flatMap(template => [
    { ...template, id: "equal", stock_quantity: 10, min_stock_alert: 10 }, { ...template, id: "zero", stock_quantity: 0, min_stock_alert: 0 },
    { ...template, id: "inactive", is_active: false, stock_quantity: 0, min_stock_alert: 10 },
    { ...template, id: "foreign", company_id: "foreign", stock_quantity: 0, min_stock_alert: 10 },
  ]);
  return state;
}

test("pure aggregation ignores tender/splits and noncompleted/foreign/end-boundary rows, preserving zero days and stock units", () => {
  const state = controlled(), before = clone(state), result = aggregateDemoOwnerDashboard(state, { outletId: P });
  assert.equal(result.summary.revenue, 220); assert.equal(result.summary.previousRevenue, 100);
  assert.equal(result.summary.transactions, 1); assert.equal(result.summary.changePercent.revenue, 120);
  assert.deepEqual(result.payments, [{ method: "cash", revenue: 220, transactions: 1 }]);
  assert.deepEqual(result.topProducts, [{ name: "Historical", quantity: 2, revenue: 210 }]);
  assert.equal(result.outlets[0].lastOrderAt, "2026-10-11T17:00:00.000Z");
  assert.deepEqual(result.purchases, { count: 1, total: 50 });
  assert.deepEqual(result.lowStock.map(row => [row.id, row.quantity, row.minimum]), [["equal", 10, 10], ["zero", 0, 0]]);
  const week = aggregateDemoOwnerDashboard(state, { range: "week" });
  assert.equal(week.trend.length, 7); assert.equal(week.trend[0].revenue, 0);
  assert.equal(week.outlets.length, 2); assert.equal(week.outlets.find(row => row.id === T)?.lastOrderAt, null);
  assert.throws(() => aggregateDemoOwnerDashboard(state, { outletId: "foreign-outlet" }), /not found/);
  state.orders[1].payment_method = "qris_manual";
  assert.equal(aggregateDemoOwnerDashboard(state).payments[0].method, "qris");
  state.orders[1].payment_method = before.orders[1].payment_method;
  assert.deepEqual(state, before);
  state.plan = "free";
  state.plans.find(row => row.slug === "free")!.report_history_days = 1;
  const capped = aggregateDemoOwnerDashboard(state, { range: "month" });
  assert.equal(capped.summary.previousRevenue, null); assert.equal(capped.summary.previousTransactions, null);
  assert.equal(capped.summary.revenue, 220); assert.equal(capped.purchases, null); assert.equal(capped.trend.length, 1);
});

test("top five and bounded low-stock rows keep deterministic ordering and a truthful full stock count", () => {
  const state = controlled(), template = state.orders[1].items[0];
  state.orders[1].items = Array.from({ length: 8 }, (_, n) => ({ ...template, id: `i${n}`, product_name: `Item ${n}`, quantity: n + 1, subtotal: 100 }));
  state.ingredients = Array.from({ length: 25 }, (_, n) => ({ ...state.ingredients[0], id: `low-${n}`, name: `Low ${String(n).padStart(2, "0")}`, stock_quantity: 5 }));
  const result = aggregateDemoOwnerDashboard(state);
  assert.deepEqual(result.topProducts.map(row => row.name), ["Item 7", "Item 6", "Item 5", "Item 4", "Item 3"]);
  assert.equal(result.lowStock.length, 20); assert.equal(result.lowStockTotal, 25); assert.equal(result.lowStock[0].name, "Low 00");
});

test("dashboard GET equals initial demo projection, validates scope/auth/range/method and never fetches", async t => {
  const network = t.mock.method(globalThis, "fetch", () => { throw new Error("network sentinel"); });
  const sandbox = owner(), request = createDemoRequestAdapter(sandbox, { app: "owner" });
  for (const range of ["today", "week", "month"] as const) for (const outletId of ["all", P, T]) {
    const response = await request(`/api/owner/dashboard?range=${range}&outlet_id=${outletId}`);
    assert.equal(response.status, 200); assert.equal(response.headers.get("X-Rakku-Demo"), "local");
    assert.deepEqual(await response.json() as OwnerDashboardAnalytics, getDemoOwnerDashboardAnalytics(sandbox, { range, outletId }));
  }
  for (const [path, method, status] of [
    ["/api/owner/dashboard?range=all", "GET", 400], ["/api/owner/dashboard?outlet_id=foreign", "GET", 404],
    ["/api/owner/dashboard?company_id=foreign", "GET", 403], ["/api/owner/dashboard", "POST", 405],
  ] as const) assert.equal((await request(path, { method })).status, status);
  sandbox.run({ type: "session.logout", mode: "owner" });
  assert.equal((await request("/api/owner/dashboard")).status, 401);
  assert.throws(() => getDemoOwnerDashboardAnalytics(sandbox), /Owner access/);
  assert.equal(network.mock.callCount(), 0);
});

test("Owner report orders exclude noncompleted rows and retain item snapshots; month report uses calendar month", async () => {
  const sandbox = owner(), request = createDemoRequestAdapter(sandbox, { app: "owner" });
  const response = await request("/api/owner/orders");
  const data = await response.json() as { orders: (DemoOrder & { items: DemoOrder["items"] })[] };
  assert.equal(data.orders.length, 120); assert.ok(data.orders.every(row => row.status === "completed" && row.items.length > 0));
  const profit = await request("/api/owner/reports/profit-loss?date_range=month");
  assert.equal(profit.status, 200);
  const expected = sandbox.report(undefined, "2026-10-01", "2026-10-12");
  assert.equal((await profit.json() as { totalRevenue: number }).totalRevenue, expected.revenue);
});
