import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import { issueSuperadminInvite, findSuperadminInvite, activateSuperadminInvite } from "./invitations";
import { deductStockForOrder } from "../../inventory/src";
import { processOrderPayment } from "../../payments/src";
import type { PaymentIntent } from "../../shared-types/src";
import { normalizeDatabaseUrl } from "./connection";

const pg = new PGlite();
const dialect = new PgDialect();
let catalog: Catalog;
function executor(connection: Pick<PGlite, "query">) {
  return async (query: SQL): Promise<Row[]> => {
    const compiled = dialect.sqlToQuery(query);
    return (await connection.query<Row>(compiled.sql, compiled.params)).rows;
  };
}
const execute = executor(pg);
const db = new DatabaseClient(execute, async () => catalog, work => pg.transaction(async tx => work(new DatabaseClient(executor(tx), async () => catalog))));
let companyA: string; let companyB: string; let outletA: string; let product: string;

before(async () => {
  for (const migration of ["0001_baseline.sql", "0002_atomic_functions.sql", "0003_tenant_policies.sql", "0004_tenant_integrity.sql"]) {
    await pg.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
  }
  catalog = await loadCatalog(execute);
  await execute(sql`select set_config('app.scope','platform',false)`);
  companyA = (await db.from("companies").insert({ code: "A", name: "A", password_hash: "hash" }).select().single()).data.id;
  companyB = (await db.from("companies").insert({ code: "B", name: "B", password_hash: "hash" }).select().single()).data.id;
  outletA = (await db.from("outlets").insert({ company_id: companyA, name: "A" }).select().single()).data.id;
  product = (await db.from("products").insert({ company_id: companyA, outlet_id: outletA, name: "Tea", price: 12000.5 }).select().single()).data.id;
});
after(() => pg.close());

test("baseline contains all application tables and portable functions", () => {
  assert.equal(Object.keys(catalog.tables).length, 39);
  assert.equal(catalog.tables.modifiers.includes("group_name"), true);
  assert.equal(catalog.tables.order_items.includes("note"), true);
  assert.equal(catalog.tables.split_payments.includes("items"), true);
});
test("Neon Console connection parameters are compatible with postgres.js", () => {
  const url = new URL(normalizeDatabaseUrl("postgresql://runtime:example@ep-test.neon.tech/neondb?sslmode=require&channel_binding=require"));
  assert.equal(url.searchParams.has("channel_binding"), false);
  assert.equal(url.searchParams.get("sslmode"), "verify-full");
});
test("filters remain parameterized and validate identifiers", async () => {
  const malicious = "' OR true; DROP TABLE products; --";
  const result = await db.from("products").select().eq("name", malicious);
  assert.equal(result.error, null); assert.deepEqual(result.data, []);
  assert.throws(() => db.from("products;drop"));
  const invalid = await db.from("products").select("password_hash");
  assert.ok(invalid.error);
  assert.ok((await db.from("products").delete()).error);
});
test("nested reverse/single relations, FK hints and inner joins", async () => {
  const { data: order } = await db.from("orders").insert({ company_id: companyA, outlet_id: outletA, subtotal: 10, tax_amount: 0, total_price: 10 }).select().single();
  await db.from("order_items").insert({ order_id: order.id, product_id: product, product_name: "Tea", unit_price: 10, subtotal: 10, quantity: 1 });
  const result = await db.from("orders").select("id, order_items(product_name, products(name)), outlets!inner(name), dining_tables!fk_orders_table(name)").eq("id", order.id).single();
  assert.equal(result.error, null);
  assert.equal(result.data.order_items[0].products.name, "Tea");
  assert.deepEqual(result.data.outlets, { name: "A" });
  assert.equal(result.data.dining_tables, null);
  assert.deepEqual((await db.from("products").select("id, categories!inner(name)")).data, []);
  const related = await db.from("order_items").select("id, products!inner(company_id)").eq("products.company_id", companyB);
  assert.equal(related.error, null); assert.deepEqual(related.data, []);
});
test("tenant links reject forged parent/resource relationships", async () => {
  const otherOutlet = (await db.from("outlets").insert({ company_id: companyB, name: "B" }).select().single()).data.id;
  const result = await db.from("products").insert({ company_id: companyA, outlet_id: otherOutlet, name: "Forged" });
  assert.ok(result.error?.message.includes("CROSS_TENANT_REFERENCE"));
});
test("count/head, pagination, boolean OR and nullable cardinality", async () => {
  const count = await db.from("companies").select("id", { count: "exact", head: true });
  assert.equal(count.count, 2); assert.equal(count.data, null);
  const page = await db.from("companies").select("code").order("code").range(1, 1);
  assert.deepEqual(page.data, [{ code: "B" }]);
  assert.equal((await db.from("products").select().eq("name", "missing").maybeSingle()).data, null);
  assert.ok((await db.from("products").select().eq("name", "missing").single()).error);
  assert.deepEqual((await db.from("companies").select("code").or("code.eq.A,code.in.(B)").order("code")).data, [{ code: "A" }, { code: "B" }]);
});
test("upsert conflict semantics and numeric/JSON response values", async () => {
  const first = await db.from("notification_logs").upsert({ company_id: companyA, type: "test", period: "2026" }, { onConflict: "company_id,type,period", ignoreDuplicates: true }).select();
  const repeat = await db.from("notification_logs").upsert({ company_id: companyA, type: "test", period: "2026" }, { onConflict: "company_id,type,period", ignoreDuplicates: true }).select();
  assert.equal(first.data?.length, 1); assert.deepEqual(repeat.data, []);
  assert.equal((await db.from("products").select("price").eq("id", product).single()).data.price, 12000.5);
});
test("ledger is atomic, tenant-keyed and duplicate-safe", async () => {
  const reference = "11111111-1111-4111-8111-111111111111";
  const params = { p_company_id: companyA, p_outlet_id: outletA, p_type: "sale_credit", p_amount: 100,
    p_pending_delta: 0, p_fee_amount: 1, p_reference_type: "test", p_reference_id: reference, p_note: null, p_created_by: "test" };
  const first = await db.rpc("apply_balance_transaction", params);
  assert.equal(first.error, null); assert.equal(first.data?.[0].inserted, true);
  const repeat = await db.rpc("apply_balance_transaction", params);
  assert.equal(repeat.data?.[0].inserted, false);
  const other = await db.rpc("apply_balance_transaction", { ...params, p_company_id: companyB, p_outlet_id: null });
  assert.equal(other.data?.[0].inserted, true);
  const denied = await db.rpc("apply_balance_transaction", { ...params, p_type: "adjustment", p_amount: -1000, p_note: "too much", p_reference_id: null });
  assert.ok(denied.error?.message.includes("INSUFFICIENT_BALANCE"));
  assert.equal((await db.from("merchant_balances").select().eq("company_id", companyA).single()).data.available_balance, 100);
});
test("transaction failure rolls back writes", async () => {
  await assert.rejects(() => db.transaction(async tx => {
    const result = await tx.from("companies").insert({ code: "ROLLBACK", name: "Rollback", password_hash: "hash" });
    if (result.error) throw new Error(result.error.message);
    throw new Error("simulated failure");
  }));
  assert.equal((await db.from("companies").select().eq("code", "ROLLBACK").maybeSingle()).data, null);
});
test("stock deduction commits the audit trail once and rolls back with its caller", async () => {
  const { data: ingredient } = await db.from("ingredients").insert({ company_id: companyA, outlet_id: outletA,
    name: "Leaves", unit: "gram", stock_quantity: 10 }).select().single();
  await db.from("product_recipes").insert({ product_id: product, ingredient_id: ingredient.id, quantity_used: 2 });
  const { data: order } = await db.from("orders").insert({ company_id: companyA, outlet_id: outletA,
    subtotal: 10, tax_amount: 0, total_price: 10 }).select().single();
  await db.from("order_items").insert({ order_id: order.id, product_id: product, product_name: "Tea", unit_price: 10, subtotal: 10, quantity: 1 });
  await assert.rejects(() => db.transaction(async tx => {
    await deductStockForOrder(tx, order.id, companyA, outletA);
    throw new Error("caller failed after stock deduction");
  }));
  assert.equal((await db.from("ingredients").select().eq("id", ingredient.id).single()).data.stock_quantity, 10);
  await deductStockForOrder(db, order.id, companyA, outletA);
  await deductStockForOrder(db, order.id, companyA, outletA);
  assert.equal((await db.from("ingredients").select().eq("id", ingredient.id).single()).data.stock_quantity, 8);
  assert.equal((await db.from("stock_movements").select("id", { count: "exact", head: true }).eq("reference_id", order.id)).count, 1);
});
test("QRIS finalization rolls back all side effects on a late ledger failure; retry credits once", async () => {
  const { data: order } = await db.from("orders").insert({ company_id: companyA, outlet_id: outletA,
    subtotal: 100, tax_amount: 0, total_price: 100, status: "pending_payment", payment_status: "unpaid" }).select().single();
  await db.from("order_items").insert({ order_id: order.id, product_id: product, product_name: "Tea", unit_price: 100, subtotal: 100, quantity: 1 });
  const { data: intent } = await db.from("payment_intents").insert({ company_id: companyA, outlet_id: outletA,
    order_id: order.id, invoice_number: "TEST-QR", provider_transaction_id: "provider-test", amount: 100 }).select().single();
  const detail = { id: "provider-test", invoice_number: "TEST-QR", payment_status: "success", amount: "100",
    qr_string: null, expired_at: new Date().toISOString(), paid_at: new Date().toISOString() };
  let failLedger = true;
  function faultyExecutor(connection: Pick<PGlite, "query">) {
    const run = executor(connection);
    return async (query: SQL) => {
      if (failLedger && dialect.sqlToQuery(query).sql.includes("apply_balance_transaction")) throw new Error("simulated ledger outage");
      return run(query);
    };
  }
  const client = new DatabaseClient(faultyExecutor(pg), async () => catalog, work =>
    pg.transaction(async tx => work(new DatabaseClient(faultyExecutor(tx), async () => catalog))));
  await assert.rejects(() => processOrderPayment(client, intent as PaymentIntent, async () => detail, () => client));
  assert.equal((await db.from("orders").select().eq("id", order.id).single()).data.status, "pending_payment");
  assert.equal((await db.from("payment_intents").select().eq("id", intent.id).single()).data.status, "pending");
  assert.equal((await db.from("stock_movements").select("id", { count: "exact", head: true }).eq("reference_id", order.id)).count, 0);
  failLedger = false;
  const completed = await processOrderPayment(client, intent as PaymentIntent, async () => detail, () => client);
  assert.equal(completed.finalized, true);
  const repeat = await processOrderPayment(client, intent as PaymentIntent, async () => detail, () => client);
  assert.equal(repeat.finalized, false);
  assert.equal((await db.from("balance_transactions").select("id", { count: "exact", head: true }).eq("reference_id", intent.id)).count, 1);
});
test("invitation is hashed, expiring, identity-bound and one-time", async () => {
  const invitation = await issueSuperadminInvite(db, "Admin@Example.com");
  assert.equal((await findSuperadminInvite(db, invitation.token))?.email, "admin@example.com");
  await assert.rejects(() => activateSuperadminInvite(db, invitation.token, { id: "wrong", email: "wrong@example.com" }));
  await activateSuperadminInvite(db, invitation.token, { id: "neon-user", email: invitation.email });
  assert.equal(await findSuperadminInvite(db, invitation.token), null);
  await assert.rejects(() => activateSuperadminInvite(db, invitation.token, { id: "neon-user", email: invitation.email }));
});
test("RLS tenant context blocks cross-company reads and writes", async () => {
  await pg.exec("CREATE ROLE tenant_test; GRANT USAGE ON SCHEMA public, app_private TO tenant_test; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO tenant_test; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO tenant_test;");
  await pg.transaction(async tx => {
    await tx.exec("SET LOCAL ROLE tenant_test");
    const run = executor(tx);
    await run(sql`select set_config('app.scope','tenant',true), set_config('app.company_id',${companyA},true), set_config('app.outlet_id',${outletA},true)`);
    const scoped = new DatabaseClient(run, async () => catalog);
    assert.deepEqual((await scoped.from("companies").select("code")).data, [{ code: "A" }]);
    assert.equal((await scoped.from("companies").select().eq("id", companyB).maybeSingle()).data, null);
    // Test a denied statement in a savepoint so the encompassing SQL transaction survives.
    await tx.exec("SAVEPOINT rejected_write");
    assert.ok((await scoped.from("products").insert({ name: "Bad", company_id: companyB, outlet_id: outletA })).error);
    await tx.exec("ROLLBACK TO SAVEPOINT rejected_write");
  });
});
