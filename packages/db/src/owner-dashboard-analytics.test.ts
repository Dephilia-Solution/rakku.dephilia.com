import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Row } from "./query";
import { loadCatalog } from "./index";
import { checked } from "./merchant";
import { readOwnerDashboardAnalytics } from "./owner-dashboard";

const pg = new PGlite(), dialect = new PgDialect();
const execute = async (query: SQL): Promise<Row[]> => {
  const compiled = dialect.sqlToQuery(query);
  return (await pg.query<Row>(compiled.sql, compiled.params)).rows;
};
const db = new DatabaseClient(execute, () => loadCatalog(execute));
const now = new Date("2026-10-12T05:00:00Z");
let companyId: string, main: string, other: string, empty: string, foreignCompany: string, foreignOutlet: string;
const read = (extra: Partial<Parameters<typeof readOwnerDashboardAnalytics>[1]> = {}) => readOwnerDashboardAnalytics(db, {
  companyId, range: "week", now, reportHistoryDays: -1, inventoryAdvanced: true, ...extra,
});

before(async () => {
  for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter(file => /^\d+_.*\.sql$/.test(file)).sort()) {
    await pg.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  await execute(sql`select set_config('app.scope','platform',false)`);
  const company = async (code: string) => String(checked(await db.from("companies").insert({ code, name: code, password_hash: "test" }).select("id").single()).id);
  const outlet = async (company_id: string, name: string, status = "active") => String(checked(await db.from("outlets").insert({ company_id, name, status }).select("id").single()).id);
  companyId = await company("DASHBOARD-A"); foreignCompany = await company("DASHBOARD-B");
  main = await outlet(companyId, "Main"); other = await outlet(companyId, "Other", "inactive"); empty = await outlet(companyId, "Empty"); foreignOutlet = await outlet(foreignCompany, "Foreign");
  // More than the usual Data API row cap; every order must contribute to SQL aggregates.
  await execute(sql`
    with inserted as (
      insert into public.orders(company_id,outlet_id,created_at,status,payment_method,subtotal,tax_amount,discount_amount,total_price)
      select ${companyId}::uuid,${main}::uuid,'2026-10-05T17:00:00Z'::timestamptz,'completed','qris',120,10,30,100
      from generate_series(1,1001) returning id
    ) insert into public.order_items(order_id,product_name,quantity,unit_price,subtotal)
      select id,'Historical coffee',1,120,120 from inserted`);
  const add = async (at: string, amount: number, name: string, quantity = 1, itemRevenue = amount, method: string | null = "cash", outlet_id = main, company_id = companyId, status = "completed") => {
    const order = checked(await db.from("orders").insert({ company_id, outlet_id, created_at: at, total_price: amount, subtotal: itemRevenue, tax_amount: 0, status, payment_method: method }).select("id").single());
    checked(await db.from("order_items").insert({ order_id: order.id, product_name: name, quantity, unit_price: itemRevenue / quantity, subtotal: itemRevenue }));
    return order.id;
  };
  const splitOrder = await add("2026-10-11T17:00:00Z", 220, "Tea", 2, 200);
  checked(await db.from("split_payments").insert([
    { order_id: splitOrder, amount: 100, payment_method: "cash", status: "paid" },
    { order_id: splitOrder, amount: 120, payment_method: "card", status: "paid" },
  ]));
  await add("2026-10-12T16:59:59.999Z", 80, "Cake", 1, 70, "card");
  await add("2026-10-10T03:00:00Z", 300, "Tea", 3, 270, "later", other);
  await add("2026-10-05T16:59:59.999Z", 50, "Prior");
  await add("2026-09-28T17:00:00Z", 150, "Prior");
  await add("2026-09-28T16:59:59.999Z", 1000, "Too old");
  await add("2026-10-12T17:00:00Z", 999, "Tomorrow");
  for (const status of ["draft", "cancelled", "pending_payment"]) await add("2026-10-12T04:00:00Z", 9000, "Not completed", 1, 9000, "cash", main, companyId, status);
  await add("2026-10-12T04:00:00Z", 888888, "Foreign", 9, 888888, "cash", foreignOutlet, foreignCompany);
  await execute(sql`insert into public.ingredients(company_id,outlet_id,name,unit,stock_quantity,min_stock_alert)
    select ${companyId}::uuid,${main}::uuid,'Low '||lpad(n::text,2,'0'),'gram',5,10 from generate_series(1,25) n`);
  checked(await db.from("ingredients").insert([
    { company_id: companyId, outlet_id: main, name: "Equal", unit: "ml", stock_quantity: 10, min_stock_alert: 10 },
    { company_id: companyId, outlet_id: main, name: "Zero", unit: "pcs", stock_quantity: 0, min_stock_alert: 0 },
    { company_id: companyId, outlet_id: main, name: "Inactive", unit: "gram", stock_quantity: 0, min_stock_alert: 10, is_active: false },
    { company_id: companyId, outlet_id: main, name: "Enough", unit: "gram", stock_quantity: 11, min_stock_alert: 10 },
    { company_id: companyId, outlet_id: other, name: "Other low", unit: "kg", stock_quantity: 0, min_stock_alert: 2 },
    { company_id: foreignCompany, outlet_id: foreignOutlet, name: "Foreign low", unit: "gram", stock_quantity: 0, min_stock_alert: 10 },
  ]));
  for (const [purchase_date, total_amount, outlet_id, company_id] of [
    ["2026-10-05T17:00:00Z", 1000, main, companyId], ["2026-10-12T16:59:59.999Z", 100, main, companyId],
    ["2026-10-05T16:59:59.999Z", 9000, main, companyId], ["2026-10-12T17:00:00Z", 9000, main, companyId],
    ["2026-10-10T03:00:00Z", 200, other, companyId], ["2026-10-12T03:00:00Z", 999999, foreignOutlet, foreignCompany],
  ] as const) checked(await db.from("ingredient_purchases").insert({ company_id, outlet_id, purchase_date, total_amount }));
});
after(() => pg.close());

test("dashboard SQL aggregates the full period, zero-fills days, and returns compact tenant-isolated projections", async () => {
  const result = await read();
  assert.equal(result.summary.revenue, 100700); assert.equal(result.summary.transactions, 1004);
  assert.equal(result.summary.averageOrder, 100700 / 1004);
  assert.equal(result.summary.previousRevenue, 200); assert.equal(result.summary.previousTransactions, 2);
  assert.equal(result.summary.changePercent.revenue, (100700 - 200) / 200 * 100);
  assert.equal(result.trend.length, 7);
  assert.deepEqual(result.trend[0], { date: "2026-10-06", revenue: 100100, transactions: 1001 });
  assert.deepEqual(result.trend[1], { date: "2026-10-07", revenue: 0, transactions: 0 });
  assert.deepEqual(result.trend.at(-1), { date: "2026-10-12", revenue: 300, transactions: 2 });
  assert.equal(result.trend.reduce((sum, row) => sum + row.revenue, 0), result.summary.revenue);
  assert.deepEqual(result.topProducts, [
    { name: "Historical coffee", quantity: 1001, revenue: 120120 }, { name: "Tea", quantity: 5, revenue: 470 }, { name: "Cake", quantity: 1, revenue: 70 },
  ]);
  assert.deepEqual(result.outletCounts, { total: 3, active: 2, inactive: 1 });
  assert.deepEqual(result.outlets.find(row => row.id === empty), { id: empty, name: "Empty", status: "active", revenue: 0, transactions: 0, lastOrderAt: null });
  assert.equal(result.outlets.find(row => row.id === main)?.lastOrderAt, "2026-10-12T16:59:59.999Z");
  assert.deepEqual(result.purchases, { count: 3, total: 1300 });
  assert.equal(result.lowStockTotal, 28); assert.equal(result.lowStock.length, 20);
  assert.deepEqual(result.lowStock[0], { id: result.lowStock[0].id, name: "Other low", outletId: other, outletName: "Other", unit: "kg", quantity: 0, minimum: 2 });
  assert.ok(!JSON.stringify(result).includes("Foreign"));
  assert.ok(!("orders" in result)); assert.ok(!("profit" in result));
});

test("today/outlet selection applies to every period metric and payment groups classify primary method only", async () => {
  const result = await read({ range: "today", outletId: main });
  assert.deepEqual(result.payments, [{ method: "cash", revenue: 220, transactions: 1 }, { method: "card", revenue: 80, transactions: 1 }]);
  assert.equal(result.summary.revenue, 300); assert.equal(result.summary.transactions, 2); assert.equal(result.summary.averageOrder, 150);
  assert.equal(result.summary.previousRevenue, 0);
  assert.deepEqual(result.summary.changePercent, { revenue: null, transactions: null, averageOrder: null });
  assert.deepEqual(result.purchases, { count: 1, total: 100 });
  assert.equal(result.outlets.length, 1); assert.equal(result.lowStockTotal, 27);
  assert.ok(result.lowStock.every(row => row.outletId === main));
  assert.deepEqual(result.topProducts, [{ name: "Tea", quantity: 2, revenue: 200 }, { name: "Cake", quantity: 1, revenue: 70 }]);
  const scoped = await read({ outletId: other });
  assert.equal(scoped.summary.revenue, 300); assert.equal(scoped.summary.transactions, 1);
  assert.deepEqual(scoped.payments, [{ method: "later", revenue: 300, transactions: 1 }]);
  assert.deepEqual(scoped.outletCounts, { total: 1, active: 0, inactive: 1 });
  await assert.rejects(() => read({ outletId: foreignOutlet }), /outlet not found/);
  await assert.rejects(() => read({ outletId: "00000000-0000-0000-0000-000000000000" }), /outlet not found/);
});

test("history cap covers current/prior/purchases consistently and suppresses unavailable comparisons", async () => {
  const result = await read({ reportHistoryDays: 3 });
  assert.equal(result.period.start, "2026-10-09T17:00:00.000Z");
  assert.equal(result.period.previousStart, "2026-10-06T17:00:00.000Z");
  assert.equal(result.period.previousAvailable, false);
  assert.equal(result.summary.revenue, 600); assert.equal(result.summary.transactions, 3);
  assert.equal(result.summary.previousRevenue, null); assert.equal(result.summary.previousTransactions, null);
  assert.deepEqual(result.summary.changePercent, { revenue: null, transactions: null, averageOrder: null });
  assert.deepEqual(result.purchases, { count: 2, total: 300 });
  assert.equal(result.trend.length, 3); assert.ok(!result.topProducts.some(row => row.name === "Historical coffee"));
  assert.equal(result.lowStockTotal, 28, "stock is a current snapshot, unaffected by history cap");
  assert.equal((await read({ inventoryAdvanced: false })).purchases, null);
  assert.equal((await read({ range: "today", reportHistoryDays: 2 })).period.previousAvailable, true);
});

test("empty company/outlet and month-to-date retain zeros, administrative counts and all calendar days", async () => {
  const result = await read({ range: "month", outletId: empty });
  assert.equal(result.trend.length, 12); assert.equal(result.trend[0].date, "2026-10-01");
  assert.ok(result.trend.every(row => row.revenue === 0 && row.transactions === 0));
  assert.equal(result.summary.averageOrder, 0); assert.deepEqual(result.topProducts, []); assert.deepEqual(result.payments, []);
  assert.deepEqual(result.purchases, { count: 0, total: 0 }); assert.equal(result.lowStockTotal, 0);
  const noCompany = await read({ companyId: "00000000-0000-0000-0000-000000000000" });
  assert.equal(noCompany.summary.revenue, 0); assert.deepEqual(noCompany.outlets, []);
  assert.deepEqual(noCompany.outletCounts, { total: 0, active: 0, inactive: 0 });
});
