import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { issueSession, isSessionActive, revokeSession, consumeSession, allowAuthAttempt, resetAuthAttempts } from "./sessions";
import { consumeOwnerPasswordReset } from "./owner-security";
import { saveEmployee, replaceProductTierPrices, deleteDraft, validateSplits } from "./merchant";
import { checkoutIdentity, findCheckout } from "./checkout";
import { quoteOrder } from "../../pricing/src/quote";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import { issueSuperadminInvite, findSuperadminInvite, activateSuperadminInvite } from "./invitations";
import { deductStockForOrder } from "../../inventory/src";
import { processOrderPayment, createQrisIntent } from "../../payments/src";
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
  await pg.transaction(async tx => {
    for (const migration of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
      await tx.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
    }
  });
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
    p_pending_delta: 0, p_unsettled_delta: 100, p_fee_amount: 1, p_reference_type: "test", p_reference_id: reference, p_note: null, p_created_by: "test" };
  const first = await db.rpc("apply_balance_transaction", params);
  assert.equal(first.error, null); assert.equal(first.data?.[0].inserted, true);
  const repeat = await db.rpc("apply_balance_transaction", params);
  assert.equal(repeat.data?.[0].inserted, false);
  const other = await db.rpc("apply_balance_transaction", { ...params, p_company_id: companyB, p_outlet_id: null });
  assert.equal(other.data?.[0].inserted, true);
  const denied = await db.rpc("apply_balance_transaction", { ...params, p_type: "adjustment", p_amount: -1000, p_unsettled_delta: 0, p_note: "too much", p_reference_id: null });
  assert.ok(denied.error?.message.includes("INSUFFICIENT_BALANCE"));
  assert.equal((await db.from("merchant_balances").select().eq("company_id", companyA).single()).data.available_balance, 0);
  assert.equal((await db.from("merchant_balances").select().eq("company_id", companyA).single()).data.unsettled_balance, 100);
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
  const privateSession = await issueSession(db, "pending", companyA, 600);
  await pg.exec("CREATE ROLE tenant_test; GRANT USAGE ON SCHEMA public, app_private TO tenant_test; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO tenant_test; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO tenant_test;");
  await pg.exec("GRANT SELECT ON ALL TABLES IN SCHEMA app_private TO tenant_test");
  await pg.transaction(async tx => {
    await tx.exec("SET LOCAL ROLE tenant_test");
    const run = executor(tx);
    await run(sql`select set_config('app.scope','tenant',true), set_config('app.company_id',${companyA},true), set_config('app.outlet_id',${outletA},true)`);
    const scoped = new DatabaseClient(run, async () => catalog);
    assert.deepEqual(await scoped.execute(sql`select id from app_private.auth_sessions where id=${privateSession}`), []);
    assert.deepEqual((await scoped.from("companies").select("code")).data, [{ code: "A" }]);
    assert.equal((await scoped.from("companies").select().eq("id", companyB).maybeSingle()).data, null);
    // Test a denied statement in a savepoint so the encompassing SQL transaction survives.
    await tx.exec("SAVEPOINT rejected_write");
    assert.ok((await scoped.from("products").insert({ name: "Bad", company_id: companyB, outlet_id: outletA })).error);
    await tx.exec("ROLLBACK TO SAVEPOINT rejected_write");
  });
});


test("ignored query errors cannot commit a partial business transaction", async () => {
  await assert.rejects(() => db.transaction(async tx => {
    await tx.from("companies").insert({ code: "PARTIAL", name: "Partial", password_hash: "hash" });
    const failure = await tx.from("companies").update({ missing_column: true }).eq("code", "PARTIAL");
    assert.ok(failure.error);
    return { success: true }; // Even an accidentally swallowed error must roll back.
  }));
  assert.equal((await db.from("companies").select().eq("code", "PARTIAL").maybeSingle()).data, null);
});

test("sessions are subject-bound, revocable, expiring and consumed once", async () => {
  const id = await issueSession(db, "pending", companyA, 600);
  assert.equal(await isSessionActive(db, id, "pending", companyA), true);
  assert.equal(await isSessionActive(db, id, "pos", companyA), false);
  assert.equal(await isSessionActive(db, id, "pending", companyB), false);
  await consumeSession(db, id, "pending", companyA);
  await assert.rejects(() => consumeSession(db, id, "pending", companyA));
  assert.equal(await isSessionActive(db, id, "pending", companyA), false);
  const login = await issueSession(db, "pos", companyA, 600);
  await revokeSession(db, login);
  assert.equal(await isSessionActive(db, login, "pos", companyA), false);
  assert.deepEqual(await Promise.all([1, 2, 3, 4].map(() => allowAuthAttempt(db, "test-ip-limit", 3, 60))), [true, true, true, false]);
  await resetAuthAttempts(db, "test-ip-limit");
  assert.equal(await allowAuthAttempt(db, "test-ip-limit", 3, 60), true);
});

test("password reset consumes the token and revokes all owner sessions atomically", async () => {
  const owner = (await db.from("owners").insert({ email: "reset@example.test", name: "Reset", password_hash: "old",
    reset_token_hash: "reset-hash", reset_token_expires_at: new Date(Date.now() + 60000).toISOString() }).select().single()).data;
  const first = await issueSession(db, "owner", owner.id, 600);
  const second = await issueSession(db, "owner", owner.id, 600);
  await consumeOwnerPasswordReset(db, "reset-hash", "new-hash");
  await assert.rejects(() => consumeOwnerPasswordReset(db, "reset-hash", "replacement"));
  const updated = (await db.from("owners").select().eq("id", owner.id).single()).data;
  assert.equal(updated.password_hash, "new-hash");
  assert.equal(updated.reset_token_hash, null);
  assert.equal(await isSessionActive(db, first, "owner", owner.id), false);
  assert.equal(await isSessionActive(db, second, "owner", owner.id), false);
});

test("employee updates cannot erase foreign assignments and reject foreign outlets before replacing", async () => {
  const roleA = (await db.from("roles").insert({ company_id: companyA, name: "Audit A" }).select().single()).data;
  const roleB = (await db.from("roles").insert({ company_id: companyB, name: "Audit B" }).select().single()).data;
  const outletB = (await db.from("outlets").insert({ company_id: companyB, name: "Audit B" }).select().single()).data;
  const employee = await saveEmployee(db, { companyId: companyB, roleId: roleB.id, name: "B", username: "audit-b", pinHash: "hash", outletIds: [outletB.id], allOutlets: false });
  await assert.rejects(() => saveEmployee(db, { companyId: companyA, employeeId: employee.id, name: "forged", outletIds: [] }));
  assert.equal((await db.from("user_outlets").select("outlet_id").eq("user_id", employee.id)).data?.[0].outlet_id, outletB.id);
  await assert.rejects(() => saveEmployee(db, { companyId: companyB, employeeId: employee.id, name: "wrong", outletIds: [outletA] }));
  await assert.rejects(() => saveEmployee(db, { companyId: companyB, employeeId: employee.id, roleId: roleA.id }));
  await assert.rejects(() => saveEmployee(db, { companyId: companyB, name: "Duplicate", username: "audit-b", pinHash: "hash", roleId: roleB.id, allOutlets: true }), /Username sudah dipakai/);
  assert.equal((await db.from("users").select("name").eq("id", employee.id).single()).data.name, "B");
  assert.equal((await db.from("user_outlets").select("outlet_id").eq("user_id", employee.id)).data?.length, 1);
});

test("tier replacement preserves old prices on invalid or duplicate input", async () => {
  const tier = (await db.from("pricing_tiers").insert({ company_id: companyA, outlet_id: outletA, name: "Tier", slug: "audit-tier" }).select().single()).data;
  await replaceProductTierPrices(db, companyA, product, [{ tier_id: tier.id, price: 13000 }]);
  await assert.rejects(() => replaceProductTierPrices(db, companyB, product, []));
  await assert.rejects(() => replaceProductTierPrices(db, companyA, product, [{ tier_id: tier.id, price: -1 }]));
  await assert.rejects(() => replaceProductTierPrices(db, companyA, product, [{ tier_id: tier.id, price: 1 }, { tier_id: tier.id, price: 2 }]));
  assert.equal((await db.from("product_tier_prices").select("price").eq("product_id", product).single()).data.price, 13000);
});

test("paid orders cannot be deleted through draft or direct SQL paths", async () => {
  const order = (await db.from("orders").insert({ company_id: companyA, outlet_id: outletA, subtotal: 10, tax_amount: 0, total_price: 10, status: "completed" }).select().single()).data;
  assert.equal(await deleteDraft(db, companyA, outletA, order.id), false);
  assert.ok((await db.from("orders").delete().eq("id", order.id)).error?.message.includes("PAID_ORDER_CANNOT_BE_DELETED"));
  const draft = (await db.from("orders").insert({ company_id: companyA, outlet_id: outletA, subtotal: 10, tax_amount: 0, total_price: 10, status: "draft", payment_status: "unpaid" }).select().single()).data;
  assert.equal(await deleteDraft(db, companyB, outletA, draft.id), false);
  assert.equal(await deleteDraft(db, companyA, outletA, draft.id), true);
});

test("server quote ignores forged amounts, validates quantities and modifier ownership", async () => {
  const scope = { company_id: companyA, outlet_id: outletA };
  const item = { product: { id: product, name: "Forged name", price: 1 }, unit_price: 1, subtotal: 1, quantity: 2, modifiers: [] };
  const quote = await quoteOrder(db, scope, { items: [item] });
  assert.equal(quote.items[0].product.name, "Tea");
  assert.equal(quote.subtotal, 24001);
  assert.equal(quote.total, 24001);
  for (const quantity of [0, -1, 1.5, NaN]) await assert.rejects(() => quoteOrder(db, scope, { items: [{ ...item, quantity }] }));
  await assert.rejects(() => quoteOrder(db, { company_id: companyB, outlet_id: outletA }, { items: [item] }));
  await assert.rejects(() => quoteOrder(db, scope, { items: [{ ...item, modifiers: [{ id: "00000000-0000-4000-8000-000000000000" }] }] }));
  assert.throws(() => validateSplits([{ amount: 1, payment_method: "cash" }], 100));
  assert.throws(() => validateSplits([{ amount: -1, payment_method: "cash" }], -1));
  validateSplits([{ amount: 40, payment_method: "cash" }, { amount: 60, payment_method: "card" }], 100);
});

test("checkout request identity reuses the committed order and rejects changed bodies", async () => {
  const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const scope = { company_id: companyA, outlet_id: outletA };
  const identity = checkoutIdentity(key, { quantity: 1, total: 10 });
  const order = await db.transaction(async tx => {
    assert.equal(await findCheckout(tx, scope, identity), null);
    return (await tx.from("orders").insert({ ...scope, ...identity, subtotal: 10, tax_amount: 0, total_price: 10 }).select().single()).data;
  });
  const same = checkoutIdentity(key, { total: 10, quantity: 1 });
  assert.equal((await db.transaction(tx => findCheckout(tx, scope, same)))?.id, order.id);
  await assert.rejects(() => db.transaction(tx => findCheckout(tx, scope, checkoutIdentity(key, { quantity: 2, total: 20 }))));
});

test("QRIS timeout retains its invoice and cannot create a second provider attempt", async () => {
  const order = (await db.from("orders").insert({ company_id: companyA, outlet_id: outletA, subtotal: 100, tax_amount: 0, total_price: 100, status: "pending_payment", payment_status: "unpaid" }).select().single()).data;
  let calls = 0;
  const provider = async () => { calls++; throw new Error("timeout after provider accepted"); };
  const input = { companyId: companyA, outletId: outletA, orderId: order.id, amount: 100, callbackUrl: "https://example.test/callback" };
  assert.ok("error" in await createQrisIntent(db, input, provider));
  assert.ok("error" in await createQrisIntent(db, input, provider));
  assert.equal(calls, 1);
  assert.equal((await db.from("payment_intents").select().eq("order_id", order.id)).data?.length, 1);
  assert.ok((await db.from("orders").select().eq("id", order.id).single()).data);
});

test("late paid expired attempts finalize once; cancelled orders enter reconciliation", async () => {
  for (const orderStatus of ["pending_payment", "cancelled"]) {
    const order = (await db.from("orders").insert({ company_id: companyA, outlet_id: outletA, subtotal: 100, tax_amount: 0, total_price: 100, status: orderStatus, payment_status: "unpaid" }).select().single()).data;
    const providerId = `late-${order.id}`;
    const intent = (await db.from("payment_intents").insert({ company_id: companyA, outlet_id: outletA, order_id: order.id, invoice_number: providerId, provider_transaction_id: providerId, amount: 100, status: "expired" }).select().single()).data as PaymentIntent;
    const detail = { id: providerId, invoice_number: providerId, amount: "100", payment_status: "success", qr_string: null, expired_at: new Date().toISOString(), paid_at: new Date().toISOString() };
    const result = await processOrderPayment(db, intent, async () => detail, () => db);
    assert.equal(result.finalized, orderStatus === "pending_payment");
    assert.equal(result.intent.status, "success");
    const repeat = await processOrderPayment(db, intent, async () => detail, () => db);
    assert.equal(repeat.finalized, false);
    const credits = (await db.from("balance_transactions").select("id", { count: "exact", head: true }).eq("reference_id", intent.id)).count;
    assert.equal(credits, orderStatus === "pending_payment" ? 1 : 0);
    const exceptions = await db.execute(sql`select * from app_private.payment_reconciliation where intent_id=${intent.id}`);
    assert.equal(exceptions.length, orderStatus === "cancelled" ? 1 : 0);
  }
});


test("historical COGS and stock deduction remain stable after recipe and cost changes", async () => {
  const ingredient = (await db.from("ingredients").insert({ company_id: companyA, outlet_id: outletA, name: "Cost fixture", unit: "gram", stock_quantity: 50, cost_per_unit: 10 }).select().single()).data;
  const sold = (await db.from("products").insert({ company_id: companyA, outlet_id: outletA, name: "Costed product", price: 100 }).select().single()).data;
  await db.from("product_recipes").insert({ product_id: sold.id, ingredient_id: ingredient.id, quantity_used: 2 });
  const order = (await db.from("orders").insert({ company_id: companyA, outlet_id: outletA, subtotal: 300, tax_amount: 0, total_price: 300 }).select().single()).data;
  await db.from("order_items").insert({ order_id: order.id, product_id: sold.id, product_name: sold.name, unit_price: 100, quantity: 3, subtotal: 300 });
  await deductStockForOrder(db, order.id, companyA, outletA);
  await db.from("ingredients").update({ cost_per_unit: 100 }).eq("id", ingredient.id);
  await db.from("product_recipes").update({ quantity_used: 4 }).eq("product_id", sold.id);
  await deductStockForOrder(db, order.id, companyA, outletA);
  assert.equal((await db.from("order_items").select("cogs_amount").eq("order_id", order.id).single()).data.cogs_amount, 60);
  assert.equal((await db.from("ingredients").select("stock_quantity").eq("id", ingredient.id).single()).data.stock_quantity, 44);
  // An order without a recipe must also be closed against future deductions.
  const plain = (await db.from("products").insert({ company_id: companyA, outlet_id: outletA, name: "No recipe", price: 100 }).select().single()).data;
  const noRecipe = (await db.from("orders").insert({ company_id: companyA, outlet_id: outletA, subtotal: 100, tax_amount: 0, total_price: 100 }).select().single()).data;
  await db.from("order_items").insert({ order_id: noRecipe.id, product_id: plain.id, product_name: plain.name, unit_price: 100, quantity: 1, subtotal: 100 });
  await deductStockForOrder(db, noRecipe.id, companyA, outletA);
  await db.from("product_recipes").insert({ product_id: plain.id, ingredient_id: ingredient.id, quantity_used: 10 });
  await deductStockForOrder(db, noRecipe.id, companyA, outletA);
  assert.equal((await db.from("ingredients").select("stock_quantity").eq("id", ingredient.id).single()).data.stock_quantity, 44);
});

test("tiered quote derives modifier, discount, tax and rupiah rounding together", async () => {
  const item = (await db.from("products").insert({ company_id: companyA, outlet_id: outletA, name: "Pricing fixture", price: 10000 }).select().single()).data;
  const tier = (await db.from("pricing_tiers").insert({ company_id: companyA, outlet_id: outletA, name: "Quote Tier", slug: "quote-tier" }).select().single()).data;
  const modifier = (await db.from("modifiers").insert({ product_id: item.id, name: "Extra", price_delta: 1000 }).select().single()).data;
  await db.from("product_tier_prices").insert({ product_id: item.id, tier_id: tier.id, price: 12000 });
  await db.from("modifier_tier_prices").insert({ modifier_id: modifier.id, tier_id: tier.id, price_delta: 2000 });
  const dates = { start_date: new Date(Date.now() - 60000).toISOString(), end_date: new Date(Date.now() + 60000).toISOString() };
  await db.from("product_discounts").insert({ company_id: companyA, outlet_id: outletA, product_id: item.id, name: "Product discount", type: "percentage", value: 10, ...dates });
  await db.from("order_discounts").insert({ company_id: companyA, outlet_id: outletA, name: "Order discount", type: "fixed", value: 1000, ...dates });
  await db.from("taxes").insert({ company_id: companyA, outlet_id: outletA, name: "Tax", type: "percentage", value: 11 });
  const quote = await quoteOrder(db, { company_id: companyA, outlet_id: outletA }, { pricingTierId: tier.id, items: [{ product_id: item.id, quantity: 2, modifiers: [{ id: modifier.id, price_delta: 1 }], unit_price: 1, subtotal: 1 }] });
  assert.equal(quote.items[0].unit_price, 14000);
  assert.equal(quote.subtotal, 25200);
  assert.equal(quote.discountAmount, 3800);
  assert.equal(quote.totalTaxAmount, 2662);
  assert.equal(quote.total, 26862);
});


test("disabling and re-enabling users or changing company credentials never resurrects sessions", async () => {
  const role = (await db.from("roles").insert({ company_id: companyA, name: "Revocation fixture" }).select().single()).data;
  const employee = await saveEmployee(db, { companyId: companyA, roleId: role.id, name: "Revocable", username: "revocable", pinHash: "hash", allOutlets: true });
  const id = await issueSession(db, "pos", employee.id, 600);
  await db.from("users").update({ status: "inactive" }).eq("id", employee.id);
  await db.from("users").update({ status: "active" }).eq("id", employee.id);
  assert.equal(await isSessionActive(db, id, "pos", employee.id), false);
  const current = await issueSession(db, "pos", employee.id, 600);
  const pending = await issueSession(db, "pending", companyA, 600);
  await db.from("companies").update({ password_hash: "rotated-fixture-hash" }).eq("id", companyA);
  assert.equal(await isSessionActive(db, current, "pos", employee.id), false);
  assert.equal(await isSessionActive(db, pending, "pending", companyA), false);
  const owner = (await db.from("owners").insert({ email: "suspended-owner@example.test", name: "Suspended Owner", password_hash: "hash" }).select().single()).data;
  await db.from("companies").update({ owner_id: owner.id }).eq("id", companyA);
  const ownerSession = await issueSession(db, "owner", owner.id, 600);
  await db.from("companies").update({ status: "suspended" }).eq("id", companyA);
  await db.from("companies").update({ status: "active" }).eq("id", companyA);
  assert.equal(await isSessionActive(db, ownerSession, "owner", owner.id), false);
});
