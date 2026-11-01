import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Row } from "./query";
import { loadCatalog } from "./index";
import { checked } from "./merchant";
import { readOwnerOutletStats, readOwnerSalesReport, readOwnerSalesTotals } from "./owner-dashboard";
import { readPlatformPaymentAnalytics, readPlatformSubscriptionAnalytics } from "./platform-analytics";
import { readActiveOwnerContext } from "./owner-session";
import { issueSession } from "./sessions";
import { getUsageSummary, countMonthlyTransactions } from "../../plans/src/index";

const pg = new PGlite(); const dialect = new PgDialect();
const execute = async (query: SQL): Promise<Row[]> => {
  const compiled = dialect.sqlToQuery(query);
  return (await pg.query<Row>(compiled.sql, compiled.params)).rows;
};
const db = new DatabaseClient(execute, () => loadCatalog(execute));
let companyId: string, outletId: string, emptyOutlet: string, foreignCompany: string, foreignOutlet: string;

before(async () => {
  for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter(file => /^\d+_.*\.sql$/.test(file)).sort()) {
    await pg.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  await execute(sql`select set_config('app.scope','platform',false)`);
  const company = async (code: string) => {
    const row = checked(await db.from("companies").insert({ code, name: code, password_hash: "test" }).select("id").single());
    return String(row.id);
  };
  const outlet = async (id: string, name: string) => String(checked(await db.from("outlets").insert({ company_id: id, name }).select("id").single()).id);
  companyId = await company("PERF-A"); foreignCompany = await company("PERF-B");
  outletId = await outlet(companyId, "Main"); emptyOutlet = await outlet(companyId, "Empty"); foreignOutlet = await outlet(foreignCompany, "Foreign");
});
after(() => pg.close());

test("outlet aggregates count all-outlet staff once, exclude inactive/foreign staff, and preserve empty outlets", async () => {
  const role = checked(await db.from("roles").insert({ company_id: companyId, name: "Staff" }).select("id").single());
  for (const [name, all, status] of [["direct", false, "active"], ["legacy", null, "active"], ["global", true, "active"], ["inactive", false, "inactive"]] as const) {
    const user = checked(await db.from("users").insert({ company_id: companyId, role_id: role.id, name, username: name, pin_hash: "test", all_outlets: all, status }).select("id").single());
    checked(await db.from("user_outlets").insert({ user_id: user.id, outlet_id: outletId }));
  }
  const category = checked(await db.from("categories").insert({ company_id: companyId, outlet_id: outletId, name: "Coffee" }).select("id").single());
  checked(await db.from("products").insert({ company_id: companyId, outlet_id: outletId, category_id: category.id, name: "Coffee", price: 100 }));
  checked(await db.from("dining_tables").insert({ company_id: companyId, outlet_id: outletId, name: "1" }));
  const rows = await readOwnerOutletStats(db, companyId);
  assert.equal(rows.length, 2);
  const main = rows.find(row => row.id === outletId)!;
  assert.deepEqual([main.employee_count, main.products_count, main.categories_count, main.tables_count], [3, 1, 1, 1]);
  assert.equal(rows.find(row => row.id === emptyOutlet)?.employee_count, 1);
  assert.equal(rows.find(row => row.id === emptyOutlet)?.products_count, 0);
  assert.ok(!rows.some(row => row.id === foreignOutlet));
});

test("sales totals and report pagination retain exact full-period totals and Jakarta half-open date boundaries", async () => {
  const add = async (company: string, outlet: string, at: string, status = "completed", amount = 100) => {
    const order = checked(await db.from("orders").insert({ company_id: company, outlet_id: outlet, subtotal: amount, tax_amount: 0, total_price: amount,
      created_at: at, status, payment_status: status === "completed" ? "paid" : "unpaid", order_type: "take_away", payment_method: "cash" }).select("id").single());
    checked(await db.from("order_items").insert({ order_id: order.id, product_name: "Coffee", unit_price: amount, subtotal: amount, quantity: 1 }));
  };
  await add(companyId, outletId, "2026-10-30T16:59:59Z", "completed", 5);
  for (let n = 0; n < 51; n++) await add(companyId, outletId, "2026-10-30T17:00:00Z");
  await add(companyId, outletId, "2026-10-31T17:00:00Z", "completed", 7);
  await add(companyId, outletId, "2026-10-31T00:00:00Z", "draft", 9000);
  await add(foreignCompany, foreignOutlet, "2026-10-31T00:00:00Z", "completed", 8000);
  const input = { companyId, start: "2026-10-30T17:00:00Z", end: "2026-10-31T17:00:00Z", page: 1 };
  const first = await readOwnerSalesReport(db, input);
  const second = await readOwnerSalesReport(db, { ...input, page: 2 });
  assert.equal(first.orders.length, 50); assert.equal(second.orders.length, 1);
  assert.deepEqual(first.summary, { totalTransactions: 51, totalRevenue: 5100, topItem: { name: "Coffee", count: 51 } });
  assert.deepEqual(first.summary, second.summary);
  const ids = new Set([...first.orders, ...second.orders].map((row: Row) => row.id));
  assert.equal(ids.size, 51, "ties must not duplicate detail rows across pages");
  assert.deepEqual(await readOwnerSalesTotals(db, companyId), { totalTransactions: 53, totalRevenue: 5112 });
  const empty = await readOwnerSalesReport(db, { ...input, outletId: emptyOutlet });
  assert.deepEqual(empty.summary, { totalTransactions: 0, totalRevenue: 0, topItem: null });
  assert.equal(empty.orders.length, 0);
  await assert.rejects(() => readOwnerSalesReport(db, { ...input, page: 0 }), /page/);
});

test("platform payment analytics aggregate amounts in SQL and group the 14-day series by Jakarta date", async () => {
  const order = checked(await db.from("orders").insert({ company_id: companyId, outlet_id: outletId, subtotal: 100, tax_amount: 0, total_price: 100 }).select("id").single());
  checked(await db.from("balance_transactions").insert([
    { company_id: companyId, type: "sale_credit", amount: 98, fee_amount: 2, created_at: "2026-10-30T17:00:00Z" },
    { company_id: companyId, type: "sale_credit", amount: 49, fee_amount: 1, created_at: "2026-09-30T16:59:59Z" },
    { company_id: companyId, type: "adjustment", amount: 999, fee_amount: 0 },
  ]));
  checked(await db.from("payment_intents").insert([
    { company_id: companyId, outlet_id: outletId, order_id: order.id, invoice_number: "PERF-PAID", status: "success", amount: 100, paid_at: "2026-10-30T17:00:00Z" },
    { company_id: companyId, outlet_id: outletId, order_id: order.id, invoice_number: "PERF-PENDING", status: "pending", amount: 500 },
  ]));
  const result = await readPlatformPaymentAnalytics(db, { monthStart: "2026-09-30T17:00:00Z", since: "2026-10-17T17:00:00Z", end: "2026-10-31T17:00:00Z" });
  assert.equal(result.totals.qrisGross, 150); assert.equal(result.totals.mdr, 3);
  assert.equal(result.totals.qrisCount, 1); assert.equal(result.month.qrisGross, 100);
  assert.equal(result.daily.length, 14);
  assert.deepEqual(result.daily.at(-1), { date: "2026-10-31", gross: 100, count: 1 });
  assert.deepEqual(result.daily[0], { date: "2026-10-18", gross: 0, count: 0 });
});

test("subscription analytics include older paid invoices and deduplicate repeated trial/limit notifications", async () => {
  const plan = checked(await db.from("plans").insert({ slug: "perf-pro", name: "Perf Pro" }).select("id").single());
  checked(await db.from("companies").update({ plan_id: plan.id }).eq("id", companyId));
  checked(await db.from("companies").update({ subscription_status: "trial" }).eq("id", foreignCompany));
  checked(await db.from("subscription_invoices").insert([
    { company_id: companyId, plan_id: plan.id, invoice_number: "PERF-SUB-OLD", amount: 50, status: "success", paid_at: "2026-09-20T00:00:00Z" },
    { company_id: companyId, plan_id: plan.id, invoice_number: "PERF-SUB-NEW", amount: 100, status: "success", paid_at: "2026-10-30T00:00:00Z" },
    { company_id: foreignCompany, plan_id: plan.id, invoice_number: "PERF-SUB-WAIT", amount: 9000, status: "pending" },
  ]));
  checked(await db.from("notification_logs").insert([
    { company_id: companyId, type: "trial_started", period: "2026-09" },
    { company_id: companyId, type: "trial_started", period: "2026-10" },
    { company_id: companyId, type: "limit_80", period: "2026-10" },
    { company_id: companyId, type: "limit_100", period: "2026-10" },
    { company_id: foreignCompany, type: "trial_started", period: "2026-10" },
  ]));
  const result = await readPlatformSubscriptionAnalytics(db, { monthStart: "2026-09-30T17:00:00Z", thirtyDaysAgo: "2026-10-01T00:00:00Z" });
  assert.deepEqual(result.summary, { paidThisMonth: 100, activeSubscriptions: 1, trialCompanies: 1, pendingInvoices: 1 });
  assert.deepEqual(result.analytics, { planDistribution: { "perf-pro": 1, none: 1 }, trialStarted: 2, trialConverted: 1, limitHit: 1, limitConverted: 1, revenueLast30Days: 100 });
});

test("owner token context is resolved in one live session/owner/company SQL boundary", async () => {
  const owner = checked(await db.from("owners").insert({ email: "owner-session-perf@example.test", name: "Owner", password_hash: "test", email_verified_at: new Date().toISOString() }).select("id").single());
  const company = checked(await db.from("companies").insert({ code: "SESSION-PERF", name: "Session Perf", password_hash: "test", owner_id: owner.id }).select("id").single());
  const sessionId = await issueSession(db, "owner", String(owner.id), 3600);
  const context = await readActiveOwnerContext(db, { ownerId: String(owner.id), sessionId });
  assert.deepEqual(context && [context.owner_id, context.session_id, context.email, context.company_id, context.company_name, context.company_code],
    [owner.id, sessionId, "owner-session-perf@example.test", company.id, "Session Perf", "SESSION-PERF"]);
  await db.execute(sql`update app_private.auth_sessions set revoked_at=now() where id=${sessionId}::uuid`);
  assert.equal(await readActiveOwnerContext(db, { ownerId: String(owner.id), sessionId }), null);
});

test("usage summary obtains exact quota counts from a single aggregate statement", async () => {
  const company = checked(await db.from("companies").insert({ code: "USAGE-PERF", name: "Usage Perf", password_hash: "test" }).select("id").single());
  const companyId = String(company.id);
  const empty = await getUsageSummary(db, companyId);
  assert.deepEqual(empty.usage, { outlets: 0, employees: 0, products: 0, ingredients: 0, transactions: 0 });
  const outlet = checked(await db.from("outlets").insert({ company_id: companyId, name: "Main" }).select("id").single());
  const role = checked(await db.from("roles").insert({ company_id: companyId, name: "Cashier" }).select("id").single());
  checked(await db.from("users").insert({ company_id: companyId, role_id: role.id, name: "Cashier", username: "cashier", pin_hash: "test" }));
  const category = checked(await db.from("categories").insert({ company_id: companyId, outlet_id: outlet.id, name: "Menu" }).select("id").single());
  checked(await db.from("products").insert({ company_id: companyId, outlet_id: outlet.id, category_id: category.id, name: "Coffee", price: 10 }));
  checked(await db.from("ingredients").insert({ company_id: companyId, outlet_id: outlet.id, name: "Bean", unit: "gram" }));
  checked(await db.from("orders").insert({ company_id: companyId, outlet_id: outlet.id, subtotal: 10, tax_amount: 0, total_price: 10,
    status: "completed", payment_status: "paid", order_type: "take_away", payment_method: "cash", created_at: new Date().toISOString() }));
  const usage = await getUsageSummary(db, companyId);
  assert.deepEqual(usage.usage, { outlets: 1, employees: 1, products: 1, ingredients: 1, transactions: 1 });
});

test("monthly quotas start at midnight Jakarta even when the deployment clock is UTC on the previous date", async t => {
  const previousTimezone=process.env.TZ;
  process.env.TZ="UTC";
  t.after(()=>{if(previousTimezone===undefined)delete process.env.TZ;else process.env.TZ=previousTimezone;});
  t.mock.timers.enable({apis:["Date"],now:Date.parse("2026-10-31T18:00:00Z")});
  const company=checked(await db.from("companies").insert({code:"QUOTA-WIB",name:"Quota WIB",password_hash:"test"}).select("id").single());
  const outlet=checked(await db.from("outlets").insert({company_id:company.id,name:"Main"}).select("id").single());
  for(const created_at of ["2026-10-31T16:59:59Z","2026-10-31T17:00:00Z"]){
    checked(await db.from("orders").insert({company_id:company.id,outlet_id:outlet.id,subtotal:10,tax_amount:0,total_price:10,status:"completed",payment_status:"paid",created_at}));
  }
  assert.equal(await countMonthlyTransactions(db,String(company.id)),1,"the previous Jakarta month cannot consume this month's quota");
  assert.equal((await getUsageSummary(db,String(company.id))).usage.transactions,1);
});
