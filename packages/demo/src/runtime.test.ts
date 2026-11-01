import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoSandbox, DEMO_IDS, fixtureId } from "../index";
import { createDemoRequestAdapter, demoViewData, getOwnerDashboardData, type DemoRequestAdapter } from "./runtime";
import { list, record, text } from "./business";
import type { DemoOrder } from "./models";

const NOW = new Date("2026-10-12T05:00:00Z"), P = DEMO_IDS.pusat, T = DEMO_IDS.taman;
const id = (kind: string, key: number, outlet: string = P) => fixtureId(outlet, kind, key);
const rows = (value: unknown) => list(value).map(record);
const key = (value: unknown) => text(value, "ID");
function owner() { const sandbox = createDemoSandbox(NOW); sandbox.run({ type: "session.owner" }); return { sandbox, request: createDemoRequestAdapter(sandbox, { app: "owner" }) }; }
function pos(manager = true) { const sandbox = createDemoSandbox(NOW); sandbox.run({ type: "session.cashier", outlet_id: P, employee_id: manager ? "fixture:rani_pusat" : "fixture:bima_pusat", pin: manager ? "111111" : "222222" }); return { sandbox, request: createDemoRequestAdapter(sandbox, { app: "pos" }) }; }
async function call(request: DemoRequestAdapter, path: string, method = "GET", body?: unknown) {
  const response = await request(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }) });
  return { response, data: await response.json() as unknown };
}
async function ok(request: DemoRequestAdapter, path: string, method = "GET", body?: unknown) { const result = await call(request, path, method, body); assert.ok(result.response.ok, JSON.stringify(result.data)); return result.data; }
function cart(product = 4, quantity = 2) { return { id: "cart-kopi", product: { id: id("product", product) }, quantity, modifiers: [], note: "Less ice", unit_price: 1, subtotal: 1 }; }

test("local auth selectors never expose PINs; company/PIN/Owner login have source envelopes and no cookies", async () => {
  const sandbox = createDemoSandbox(NOW), request = createDemoRequestAdapter(sandbox, { app: "pos" });
  const outlets = await ok(request, "/api/auth/tenant/outlet"); assert.equal(rows(record(outlets).outlets).length, 2);
  const accounts = await ok(request, "/api/auth/tenant/accounts"); assert.equal(rows(record(accounts).accounts).length, 2); assert.ok(rows(record(accounts).accounts).every(row => !("pin" in row) && !("pin_hash" in row)));
  const before = sandbox.getSnapshot(); const wrong = await call(request, "/api/auth/tenant/company", "POST", { code: "DEMO_CAFE", password: "wrong" }); assert.equal(wrong.response.status, 401); assert.equal(sandbox.getSnapshot(), before);
  const company = await call(request, "/api/auth/tenant/company", "POST", { code: "demo_cafe", password: "DemoCafe2026!" }); assert.equal(record(company.data).company_id, DEMO_IDS.company); assert.equal(company.response.headers.get("Set-Cookie"), null);
  await ok(request, "/api/auth/tenant/outlet", "POST", { outlet_id: T }); const taman = await ok(request, "/api/auth/tenant/accounts"); assert.deepEqual(rows(record(taman).accounts).map(row => row.name), ["Dita", "Raka"]);
  const bad = await call(request, "/api/auth/tenant/verify-pin", "POST", { user_id: "fixture:rani_pusat", pin: "111111" }); assert.equal(bad.response.status, 403);
  const login = await ok(request, "/api/auth/tenant/verify-pin", "POST", { user_id: "fixture:dita_taman", pin: "333333" }); assert.equal(record(login).redirect, "/register");
  const session = await ok(request, "/api/auth/tenant/session"); assert.equal(record(session).user_name, "Dita"); assert.equal(record(session).role_name, "Manager Outlet"); assert.ok(!("token" in record(session)));
  const switched = await call(request, "/api/auth/tenant/switch-user", "POST"); assert.equal(switched.response.status, 303); assert.equal(switched.response.headers.get("Location"), "/login/select-user"); assert.equal(sandbox.getSnapshot().session.employee_id, null);
  const ownerRequest = createDemoRequestAdapter(sandbox, { app: "owner" });
  const ownerLogin = await ok(ownerRequest, "/api/auth/owner/login", "POST", { email: "owner@rakku.invalid", password: "DemoCafe2026!", remember: true }); assert.equal(record(ownerLogin).redirect, "/");
  const ownerSession = await ok(ownerRequest, "/api/auth/owner/session"); assert.equal(record(record(ownerSession).owner).has_company, true);
  const settings = await ok(ownerRequest, "/api/owner/settings", "PUT", { new_company_password: "ABC123" }); assert.equal(record(settings).updated, "password");
  await ok(request, "/api/auth/tenant/company", "POST", { code: "DEMO_CAFE", password: "ABC123" });
  await ok(ownerRequest, "/api/auth/owner/login", "POST", { email: "owner@rakku.invalid", password: "DemoCafe2026!" });
});

test("original Owner catalog contracts cover category/tier/product prices/modifiers/recipes and strict foreign relations", async () => {
  const { sandbox, request } = owner();
  assert.equal(rows(record(await ok(request, `/api/owner/products?outlet_id=${P}`)).products).length, 10);
  const category = record(await ok(request, "/api/owner/categories", "POST", { outlet_id: P, name: "New drinks" }));
  const product = record(await ok(request, "/api/owner/products", "POST", { outlet_id: P, name: "New latte", category_id: category.id, price: 10000, is_active: true, description: "Demo" }));
  await ok(request, "/api/owner/product-tier-prices", "POST", { productId: product.id, prices: [{ tier_id: id("tier", 0), price: 12000 }] });
  const prices = await ok(request, `/api/owner/product-tier-prices?product_id=${product.id}`); assert.equal(rows(record(prices).prices)[0].price, 12000);
  const modifier = record(await ok(request, "/api/owner/modifiers", "POST", { product_id: product.id, name: "Vanilla", group_name: "Sirup", prices: [{ tier_id: id("tier", 0), price_delta: 2500 }] }));
  await ok(request, "/api/owner/modifiers", "PATCH", { id: modifier.id, name: "Vanilla baru", prices: [{ tier_id: id("tier", 0), price_delta: 3000 }] });
  const modifiers = await ok(request, `/api/owner/modifiers?product_id=${product.id}`); assert.equal(rows(rows(record(modifiers).modifiers)[0].tier_prices)[0].price_delta, 3000);
  const recipe = record(await ok(request, "/api/owner/recipes", "POST", { product_id: product.id, ingredient_id: id("ingredient", 1), quantity_used: 150 }));
  assert.ok(key(recipe.id).startsWith(sandbox.generation)); assert.equal(record(recipe.ingredients).unit, "ml");
  const before = sandbox.getSnapshot(); const foreign = await call(request, "/api/owner/recipes", "POST", { product_id: product.id, ingredient_id: id("ingredient", 0, T), quantity_used: 1 }); assert.equal(foreign.response.status, 403); assert.equal(sandbox.getSnapshot(), before);
  await ok(request, `/api/owner/recipes?id=${recipe.id}`, "DELETE"); await ok(request, `/api/owner/modifiers?id=${modifier.id}`, "DELETE");
  const tier = record(record(await ok(request, "/api/owner/pricing-tiers", "POST", { outlet_id: P, name: "Special", slug: "special", sort_order: 5 })).tier);
  await ok(request, `/api/owner/pricing-tiers/${tier.id}`, "PATCH", { is_active: false }); await ok(request, `/api/owner/pricing-tiers/${tier.id}`, "DELETE");
  await ok(request, `/api/owner/products?id=${product.id}`, "DELETE"); await ok(request, `/api/owner/categories?id=${category.id}`, "DELETE");
});

test("Owner employee allOutlets, atomic menu grants, status and PIN forms preserve assignment semantics", async () => {
  const { sandbox, request } = owner(); const role = record(record(await ok(request, "/api/owner/roles", "POST", { name: "New manager" })).role);
  const menus = rows(record(await ok(request, "/api/owner/roles")).menus);
  const before = record(await ok(request, `/api/owner/roles/${role.id}/access`));
  const grant = { menu_id: menus[0].id, can_view: true, can_create: true, can_edit: true, can_delete: true };
  await ok(request, `/api/owner/roles/${role.id}/access`, "POST", { grants: [grant], expectedRevision: before.revision });
  const after = record(await ok(request, `/api/owner/roles/${role.id}/access`));
  assert.deepEqual(after.grants, [grant]); assert.deepEqual(after.menu_access, [menus[0].id]);
  const stale = await call(request, `/api/owner/roles/${role.id}/access`, "POST", { grants: [], expectedRevision: before.revision });
  assert.equal(stale.response.status, 409);
  const invalid = await call(request, `/api/owner/roles/${role.id}/access`, "POST", { grants: [{ ...grant, can_view: false }], expectedRevision: after.revision });
  assert.equal(invalid.response.status, 400);
  const disabledGrant = { menu_id: menus[0].id, can_view: false, can_create: false, can_edit: false, can_delete: false };
  await ok(request, `/api/owner/roles/${role.id}/access`, "POST", { grants: [disabledGrant], expectedRevision: after.revision });
  const disabled = record(await ok(request, `/api/owner/roles/${role.id}/access`));
  assert.deepEqual(disabled.grants, [disabledGrant]);
  assert.deepEqual(disabled.menu_access, []);
  await ok(request, `/api/owner/roles/${role.id}/access`, "POST", { grants: [grant], expectedRevision: disabled.revision });
  const employee = record(record(await ok(request, "/api/owner/employees", "POST", { name: "Sinta", username: "sinta", pin: "555555", roleId: role.id, allOutlets: true, outletIds: [] })).employee);
  assert.deepEqual(Object.keys(employee), ["id"]);
  const outlet = record(record(await ok(request, "/api/owner/outlets", "POST", { name: "Baru", address: "Jl. Baru" })).outlet);
  const login = sandbox.getLoginContext(key(outlet.id)); assert.ok(login.accounts.some(row => row.id === employee.id));
  assert.equal(sandbox.getSnapshot().tiers.filter(row => row.outlet_id === outlet.id).length, 2);
  await ok(request, `/api/owner/employees/${employee.id}`, "PATCH", { reset_pin: true, new_pin: "555556" });
  sandbox.run({ type: "session.cashier", outlet_id: key(outlet.id), employee_id: key(employee.id), pin: "555556" }); assert.equal(sandbox.getTenantSession().user_name, "Sinta");
  sandbox.run({ type: "session.owner" }); await ok(request, `/api/owner/employees/${employee.id}`, "PATCH", { toggle_status: true });
  assert.equal(record(await ok(request, `/api/owner/employees/${employee.id}`, "PATCH", { toggle_status: true })).status, "active");
  await ok(request, `/api/owner/employees/${employee.id}`, "DELETE"); await ok(request, `/api/owner/roles/${role.id}`, "DELETE"); await ok(request, `/api/owner/outlets/${outlet.id}`, "DELETE");
});

test("POS stock forms adjust atomically, accept empty opname notes, purchases expand ingredient names, and expenses/tables CRUD work", async () => {
  const { sandbox, request } = pos();
  const ingredient = record(await ok(request, "/api/admin/ingredients", "POST", { name: "Vanilla", unit: "ml", stock_quantity: 10, min_stock_alert: 5, cost_per_unit: 10 }));
  await ok(request, "/api/admin/ingredients", "PATCH", { id: ingredient.id, name: "Vanilla syrup", unit: "ml", stock_quantity: 25, min_stock_alert: 5, cost_per_unit: 12, is_active: true });
  assert.equal(sandbox.getSnapshot().movements.at(-1)!.quantity_change, 15);
  await ok(request, `/api/admin/ingredients/${ingredient.id}/adjust`, "POST", { stock_quantity: 30, note: "" }); assert.equal(sandbox.getSnapshot().ingredients.find(row => row.id === ingredient.id)!.stock_quantity, 30);
  const before = sandbox.getSnapshot(); const invalid = await call(request, "/api/admin/ingredients", "PATCH", { id: ingredient.id, stock_quantity: 50, unit: "bad" }); assert.equal(invalid.response.status, 400); assert.equal(sandbox.getSnapshot(), before);
  const purchase = await ok(request, "/api/admin/purchases", "POST", { supplier_name: "Supplier", purchase_date: "2026-10-12", note: "", items: [{ ingredient_id: ingredient.id, quantity: 10, unit_cost: 15 }] }); assert.equal(record(purchase).total_amount, 150);
  const purchases = rows(await ok(request, "/api/admin/purchases")); assert.equal(rows(purchases.at(-1)!.items)[0].ingredient_name, "Vanilla syrup");
  const expense = record(await ok(request, "/api/admin/expenses", "POST", { category: "Operasional", amount: 10000, description: "Demo", expense_date: "2026-10-12" }));
  await ok(request, "/api/admin/expenses", "PATCH", { id: expense.id, amount: 12000 }); await ok(request, `/api/admin/expenses?id=${expense.id}`, "DELETE");
  const table = record(await ok(request, "/api/admin/tables", "POST", { name: "Meja Baru" })); await ok(request, "/api/admin/tables", "PATCH", { id: table.id, status: "occupied" }); await ok(request, `/api/admin/tables?id=${table.id}`, "DELETE");
  assert.equal(rows(await ok(request, "/api/admin/tables/generate", "POST", { count: 2 })).length, 2);
});

test("charges accept datetime-local precision and actual Owner/POS wrappers with active projections", async () => {
  const o = owner(); const tax = record(record(await ok(o.request, "/api/owner/taxes", "POST", { outlet_id: P, name: "Service", type: "fixed", value: 1000 })).tax);
  await ok(o.request, `/api/owner/taxes/${tax.id}`, "PATCH", { is_active: false }); assert.ok(rows(record(await ok(o.request, `/api/owner/taxes?outlet_id=${P}`)).taxes).some(row => row.id === tax.id));
  const discount = record(record(await ok(o.request, "/api/owner/discounts", "POST", { outlet_id: P, scope: "order", name: "Window", type: "fixed", value: 1000, start_date: "2026-10-12T11:59", end_date: "2026-10-12T12:01" })).discount);
  assert.equal(discount.start_date, "2026-10-12T04:59:00.000Z"); assert.ok(demoViewData(o.sandbox).activeOrderDiscounts.some(row => row.id === discount.id));
  o.sandbox.run({ type: "tick", now: "2026-10-12T05:01:00.001Z" }); assert.ok(!demoViewData(o.sandbox).activeOrderDiscounts.some(row => row.id === discount.id));
  await ok(o.request, `/api/owner/discounts/${discount.id}?scope=order`, "DELETE"); await ok(o.request, `/api/owner/taxes/${tax.id}`, "DELETE");
  const p = pos(false); assert.ok(Array.isArray(await ok(p.request, "/api/admin/taxes/active"))); assert.ok("productDiscounts" in record(await ok(p.request, "/api/admin/discounts/active")));
});

test("original cart DTOs are server-priced, custom modifiers are local snapshots, and edited drafts complete exactly once", async () => {
  const { sandbox, request } = pos(false), before = sandbox.getSnapshot().ingredients;
  const item = { ...cart(), modifiers: [{ id: "custom-123", product_id: id("product", 4), name: "Vanilla", price_delta: 2500, group_name: "Tambahan" }] };
  const draft = record(await ok(request, "/api/admin/orders/draft", "POST", { items: [item], customerName: "Nadia", pricingTierId: id("tier", 0), tableId: null, companyId: DEMO_IDS.company, outletId: P, cashierId: "fixture:bima_pusat" }));
  assert.equal(draft.total_price, 62700); assert.equal(rows(draft.order_items)[0].unit_price, 28500); assert.equal(sandbox.getSnapshot().movements.filter(row => row.reference_id === draft.id).length, 0);
  const completed = record(await ok(request, `/api/admin/orders/draft?id=${draft.id}`, "PATCH", { status: "completed", payment_method: "cash", pricing_tier_id: id("tier", 0), customer_name: "Nadia edited", table_id: null, order_type: "take_away", subtotal: 1, total_price: 1,
    items: [{ ...item, quantity: 3 }], splits: [{ method: "cash", amount: 30000, customer_name: "A", items: [{ cart_item_id: "cart-kopi", quantity: 1 }] }, { method: "card", amount: 64050, customer_name: "B", items: [{ cart_item_id: "cart-kopi", quantity: 2 }] }] }));
  assert.equal(completed.id, draft.id); assert.equal(completed.total_price, 94050); assert.equal(completed.status, "completed"); assert.equal(rows(completed.split_payments)[0].customer_name, "A");
  sandbox.run({ type: "session.owner" }); assert.equal(sandbox.getSnapshot().ingredients.find(row => row.id === id("ingredient", 0))!.stock_quantity, 5946); assert.equal(sandbox.getSnapshot().products.find(row => row.id === id("product", 4))!.modifiers.length, 2);
  const once = sandbox.getSnapshot(); sandbox.run({ type: "order.complete", id: key(draft.id), payment_method: "cash" }); assert.equal(sandbox.getSnapshot(), once);
  assert.equal(before.length, 0, "cashier cannot inspect ingredient records");
});

test("dynamic QRIS facade creates/polls/retries/cancels without provider finalization and manual QRIS never credits", async () => {
  const { sandbox, request } = pos(false); const body = { items: [cart()], orderType: "dine_in", customerName: "Guest", tableId: null, pricingTierId: id("tier", 0), subtotal: 1, total: 1 };
  const qris = record(await ok(request, "/api/admin/orders/qris", "POST", body)), order = record(qris.order), intent = record(qris.intent);
  assert.equal(intent.amount, 57200); assert.match(key(intent.qr_string), /NOT-PAYABLE/);
  assert.equal(record(record(await ok(request, `/api/admin/orders/qris/${order.id}`)).order).status, "pending_payment");
  const retried = record(await ok(request, `/api/admin/orders/qris/${order.id}/retry`, "POST")); assert.notEqual(record(retried.intent).id, intent.id);
  sandbox.run({ type: "payment.transition", id: key(record(retried.intent).id), status: "success" }); assert.equal(record(record(await ok(request, `/api/admin/orders/qris/${order.id}`)).order).status, "completed");
  const second = record(await ok(request, "/api/admin/orders/qris", "POST", body)); await ok(request, `/api/admin/orders/qris/${record(second.order).id}/cancel`, "POST");
  const credits = sandbox.getSnapshot().payments.filter(row => row.status === "success").length;
  const manual = record(await ok(request, "/api/admin/orders", "POST", { ...body, paymentMethod: "qris", status: "completed" })); assert.equal(manual.payment_channel, "manual_qris"); assert.equal(sandbox.getSnapshot().payments.filter(row => row.status === "success").length, credits);
});

test("billing, balance, bank and report envelopes stay local and report preview is explicitly simulated", async () => {
  const { sandbox, request } = owner(); const summary = record(await ok(request, "/api/owner/subscription")); assert.equal(record(record(summary.summary).usage).outlets, 2);
  const checkout = record(await ok(request, "/api/owner/subscription/checkout", "POST", { plan_slug: "pro", billing_cycle: "yearly" })), invoice = record(checkout.invoice);
  assert.equal(record(record(await ok(request, `/api/owner/subscription/invoices/${invoice.id}/sync`, "POST")).invoice).status, "pending");
  sandbox.run({ type: "subscription.transition", id: key(invoice.id), status: "success" }); assert.equal(record(record(await ok(request, `/api/owner/subscription/invoices/${invoice.id}`)).invoice).status, "success");
  assert.ok("balance" in record(await ok(request, "/api/owner/balance"))); assert.equal(rows(record(await ok(request, "/api/owner/balance/transactions?limit=2&offset=1")).transactions).length, 2);
  const bank = record(record(await ok(request, "/api/owner/bank-accounts", "POST", { bank_name: "Bank Fiksi", account_number: "1234 5678", account_holder: "Demo", is_default: false })).bank_account);
  await ok(request, `/api/owner/bank-accounts/${bank.id}`, "PATCH", { is_default: true }); await ok(request, `/api/owner/bank-accounts/${bank.id}`, "DELETE");
  const preview = record(await ok(request, "/api/owner/reports/send-email", "POST", { email: "owner@rakku.invalid", dateRange: "today", outlet_id: P })); assert.equal(preview.success, true); assert.match(String(preview.message), /Simulasi/); assert.match(String(preview.preview), /tidak dikirim/);
  assert.equal(request.getLastPreview()!.report.orders, 2); assert.equal(request.getLastPreview()!.report.outlet_id, P);
  const profit = record(await ok(request, `/api/owner/reports/profit-loss?date_range=today&outlet_id=${P}`)); assert.equal(profit.totalTransactions, 2);
});

test("content-cached root projections keep Register arrays stable across ticks and preserve original view fields", () => {
  const { sandbox, request } = owner(), dashboard = getOwnerDashboardData(sandbox); assert.equal(dashboard.totalTransactions, 120); assert.equal(dashboard.outlets[0].employee_count, 2);
  const first = request.getViewData(); sandbox.run({ type: "tick" }); const next = request.getViewData();
  for (const key of ["products", "categories", "tiers", "modifiers", "productTierPrices", "plans", "orders", "register"] as const) assert.equal(next[key], first[key], key);
  assert.ok(first.orders[0].order_items); assert.ok(first.invoices[0].plans.name); assert.ok(first.purchases[0].items[0].ingredient_name);
  sandbox.run({ type: "entity.save", entity: "products", value: { id: id("product", 0), name: "Changed" } }); assert.notEqual(request.getViewData().products, first.products);
  sandbox.run({ type: "session.cashier", outlet_id: P, employee_id: "fixture:bima_pusat", pin: "222222" }); const scoped = demoViewData(sandbox); assert.equal(scoped.products.length, 10); assert.equal(scoped.ingredients.length, 0); assert.equal(scoped.employees.length, 0); assert.equal(scoped.balance, null); assert.equal(scoped.tenant!.role_name, "Kasir");
});

test("generation and active scope guard dispatch AND delayed JSON consumption; destroyed callbacks cannot mutate a replacement", async () => {
  const a = owner(), b = owner(); let active = true; const request = createDemoRequestAdapter(a.sandbox, { app: "owner", active: () => active });
  const response = await request(`/api/owner/products?outlet_id=${P}`); active = false;
  await assert.rejects(response.json(), { name: "AbortError" }); await assert.rejects(request("/api/owner/categories", { method: "POST", body: JSON.stringify({ outlet_id: P, name: "Stale" }) }), { name: "AbortError" });
  const before = b.sandbox.getSnapshot(); a.sandbox.destroy(); await assert.rejects(a.request("/api/owner/outlets"), { name: "AbortError" }); assert.equal(b.sandbox.getSnapshot(), before);
  const controller = new AbortController(); controller.abort(); await assert.rejects(b.request("/api/owner/outlets", { signal: controller.signal }), { name: "AbortError" });
});

test("fail-closed URL/app/resource guards never invoke global fetch and return meaningful PLAN_LIMIT envelopes", async t => {
  const sentinel = t.mock.method(globalThis, "fetch", () => { throw new Error("network sentinel"); }); const o = owner();
  for (const path of ["https://provider.invalid/api/owner/products", "//provider.invalid/api/owner/products", "/api/owner/unknown", "/api/owner/products/not-a-route", "/api/admin/products"]) {
    const before = o.sandbox.getSnapshot(), result = await call(o.request, path, "POST", { outlet_id: P, name: "Wrong", category_id: id("category", 0), price: 1 }); assert.ok(!result.response.ok); assert.equal(o.sandbox.getSnapshot(), before);
  }
  const free = o.sandbox.run({ type: "subscription.checkout", plan: "free", billing_cycle: "monthly" }) as { id: string }; o.sandbox.run({ type: "subscription.transition", id: free.id, status: "success" });
  const limited = await call(o.request, "/api/owner/outlets", "POST", { name: "Over quota", address: "Fiksi" }); assert.equal(limited.response.status, 403); assert.equal(record(limited.data).code, "PLAN_LIMIT"); assert.equal(record(limited.data).current, 2); assert.equal(record(limited.data).max, 1);
  const p = pos(false); const denied = await call(p.request, "/api/admin/ingredients"); assert.equal(denied.response.status, 403); assert.equal(sentinel.mock.callCount(), 0);
});

test("visitor-created catalog IDs cannot be reused by another adapter and legacy pricing options have full CRUD", async () => {
  const a = pos(), b = pos(); const option = record(await ok(a.request, "/api/admin/pricing-options", "POST", { product_id: id("product", 0), company_id: DEMO_IDS.company, outlet_id: P, name: "Double", price: 25000 }));
  await ok(a.request, "/api/admin/pricing-options", "PATCH", { id: option.id, price: 26000 }); assert.equal(rows(await ok(a.request, `/api/admin/pricing-options?product_id=${id("product", 0)}`))[0].price, 26000);
  const before = b.sandbox.getSnapshot(), foreign = await call(b.request, "/api/admin/pricing-options", "PATCH", { id: option.id, price: 1 }); assert.equal(foreign.response.status, 404); assert.equal(b.sandbox.getSnapshot(), before);
  await ok(a.request, `/api/admin/pricing-options?id=${option.id}`, "DELETE"); assert.equal(rows(await ok(a.request, "/api/admin/pricing-options")).length, 0);
});

const requestId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("Owner purchase ISO dates normalize to Jakarta calendar days and replay without duplicate stock", async () => {
  const sandbox = createDemoSandbox(new Date("2026-10-26T05:00:00Z")); sandbox.run({ type: "session.owner" });
  const request = createDemoRequestAdapter(sandbox, { app: "owner" }), ingredientId = id("ingredient", 0, T);
  const cases = [
    ["2026-10-26", "2026-10-26"],
    ["2026-10-26T00:00:00.000Z", "2026-10-26"],
    ["2026-10-25T17:00:00.000Z", "2026-10-26"],
    ["2026-10-25T16:59:59.999Z", "2026-10-25"],
    ["2026-10-26T00:00:00+07:00", "2026-10-26"],
  ];
  for (const [index, [date, expected]] of cases.entries()) {
    const body = { outlet_id: T, supplier: "Owner ISO supplier", date, note: "Tanggal pembelian Owner", request_id: requestId(300 + index),
      items: [{ ingredient_id: ingredientId, quantity: 1, unit_cost: 42 }] };
    const stock = sandbox.getSnapshot().ingredients.find(row => row.id === ingredientId)!.stock_quantity;
    const created = record(await ok(request, "/api/owner/purchases", "POST", body));
    const stored = sandbox.getSnapshot().purchases.find(row => row.id === created.id)!;
    assert.equal(stored.purchase_date, expected); assert.equal(stored.outlet_id, T);
    assert.equal(sandbox.getSnapshot().ingredients.find(row => row.id === ingredientId)!.stock_quantity, stock + 1);
    const committed = sandbox.getSnapshot();
    assert.deepEqual(await ok(request, "/api/owner/purchases", "POST", body), created); assert.equal(sandbox.getSnapshot(), committed);
  }
  for (const date of ["2026-02-30T00:00:00.000Z", "2026-10-25T17:00:00", "not-a-date", "2026-10-26T17:00:00.000Z"]) {
    const before = sandbox.getSnapshot();
    const rejected = await call(request, "/api/owner/purchases", "POST", { outlet_id: T, supplier: "Invalid date", date, note: "Test", request_id: requestId(310), items: [{ ingredient_id: ingredientId, quantity: 1, unit_cost: 42 }] });
    assert.equal(rejected.response.status, 400); assert.equal(sandbox.getSnapshot(), before);
  }
  const p = pos();
  const created = record(await ok(p.request, "/api/admin/purchases", "POST", { supplier_name: "POS ISO date", purchase_date: "2026-10-11T17:00:00.000Z", note: "Test", items: [{ ingredient_id: id("ingredient", 0), quantity: 1, unit_cost: 42 }] }));
  assert.equal(p.sandbox.getSnapshot().purchases.find(row => row.id === created.id)!.purchase_date, "2026-10-12");
});

test("Owner product drafts commit prices and recipes atomically, clear recipes, and retain omitted composition/addons", async () => {
  const { sandbox, request } = owner();
  const body = { outlet_id: T, name: "Composed latte", category_id: id("category", 0, T), price: 15000, description: "Draft", image_url: null,
    prices: [{ tier_id: id("tier", 0, T), price: 17000 }], recipes: [{ ingredient_id: id("ingredient", 1, T), quantity_used: 125.5 }], request_id: requestId(1) };
  let publications = 0; const unsubscribe = sandbox.subscribe(() => { publications++; });
  const product = record(await ok(request, "/api/owner/products", "POST", body)); assert.equal(publications, 1);
  assert.equal(product.image_url, null);
  assert.deepEqual(product.prices, { [id("tier", 0, T)]: 17000 });
  const recipe = rows(await ok(request, `/api/owner/recipes?product_id=${product.id}`)); assert.equal(recipe[0].quantity_used, 125.5);
  assert.equal(record(recipe[0].ingredients).unit, "ml");
  for (const patch of [
    { category_id: id("category", 0) }, { prices: [{ tier_id: id("tier", 0), price: 20000 }] },
    { recipes: [{ ingredient_id: id("ingredient", 0), quantity_used: 1 }] },
    { recipes: [{ ingredient_id: id("ingredient", 1, T), quantity_used: 0 }] },
    { recipes: [body.recipes[0], body.recipes[0]] }, { prices: [body.prices[0], body.prices[0]] },
    { recipes: null }, { prices: [{ tier_id: id("tier", 0, T), price: -1 }] },
  ]) {
    const before = sandbox.getSnapshot(), notifications: number = publications;
    const rejected = await call(request, "/api/owner/products", "PATCH", { id: product.id, outlet_id: T, name: "Must roll back", ...patch });
    assert.ok(!rejected.response.ok); assert.equal(sandbox.getSnapshot(), before); assert.equal(publications, notifications);
  }
  await ok(request, "/api/owner/modifiers", "POST", { product_id: product.id, name: "Extra shot", price_delta: 3000 });
  const addons = sandbox.getSnapshot().products.find(row => row.id === product.id)!.modifiers;
  const beforeMetadata = sandbox.getSnapshot().products.find(row => row.id === product.id)!;
  await ok(request, "/api/owner/products", "PATCH", { id: product.id, description: "Legacy metadata edit" });
  const afterMetadata = sandbox.getSnapshot().products.find(row => row.id === product.id)!;
  assert.deepEqual(afterMetadata.recipe, beforeMetadata.recipe); assert.deepEqual(afterMetadata.prices, beforeMetadata.prices);
  await ok(request, "/api/owner/products", "PATCH", { id: product.id, name: "Renamed", recipes: [] });
  const cleared = sandbox.getSnapshot().products.find(row => row.id === product.id)!;
  assert.deepEqual(cleared.recipe, []); assert.deepEqual(cleared.prices, product.prices); assert.deepEqual(cleared.modifiers, addons);
  await ok(request, "/api/owner/products", "PATCH", { id: product.id, description: "Metadata only" });
  assert.deepEqual(await ok(request, `/api/owner/recipes?product_id=${product.id}`), []);
  const beforeReplay = sandbox.getSnapshot();
  const otherAdapter = createDemoRequestAdapter(sandbox, { app: "owner" });
  assert.deepEqual(await ok(otherAdapter, "/api/owner/products", "POST", { ...body, prices: body.prices.map(row => ({ price: row.price, tier_id: row.tier_id })) }), product);
  assert.equal(sandbox.getSnapshot(), beforeReplay, "replay returns the original receipt without overwriting later edits");
  const conflict = await call(request, "/api/owner/products", "POST", { ...body, name: "Different request" });
  assert.equal(conflict.response.status, 409); assert.equal(record(conflict.data).code, "IDEMPOTENCY_CONFLICT"); assert.equal(sandbox.getSnapshot(), beforeReplay);
  const legacy = record(await ok(request, "/api/owner/products", "POST", { outlet_id: P, name: "Legacy", category_id: id("category", 0), price: 1000 }));
  assert.deepEqual(legacy.recipe, []); assert.deepEqual(legacy.prices, {}); unsubscribe();
});

test("Owner opening stock, purchases, opname and paginated history stay in the requested outlet and replay across adapters", async t => {
  const sentinel = t.mock.method(globalThis, "fetch", () => { throw new Error("inventory network escape"); });
  const { sandbox, request } = owner(), other = owner(); const pusatBefore = sandbox.getSnapshot().ingredients.filter(row => row.outlet_id === P);
  const ingredient = record(await ok(request, "/api/owner/ingredients", "POST", { outlet_id: T, name: "Sirup baru", unit: "ml", stock_quantity: 10.25, min_stock_alert: 2, cost_per_unit: 5 }));
  const ingredientId = key(ingredient.id), adjustPath = `/api/owner/ingredients/${ingredientId}/adjust`;
  const purchaseBody = { outlet_id: T, supplier: "Supplier Owner", date: "2026-10-12", note: "Restock Owner", request_id: requestId(2),
    items: [{ ingredient_id: ingredientId, quantity: 2.5, unit_cost: 12.34 }, { ingredient_id: id("ingredient", 0, T), quantity: 1, unit_cost: 5.55 }] };
  const purchase = record(await ok(request, "/api/owner/purchases", "POST", purchaseBody)); assert.equal(purchase.total_amount, 36.4);
  assert.equal(sandbox.getSnapshot().ingredients.find(row => row.id === ingredientId)!.stock_quantity, 12.75);
  const adjustBody = { outlet_id: T, quantity: 7.5, note: "Hitung fisik Owner", request_id: requestId(3) };
  const adjustment = record(await ok(request, adjustPath, "POST", adjustBody)); assert.equal(adjustment.quantity_change, -5.25);
  await ok(request, "/api/owner/purchases", "POST", { ...purchaseBody, request_id: requestId(4), items: [{ ingredient_id: ingredientId, quantity: 1, unit_cost: 15 }] });
  const beforeReplay = sandbox.getSnapshot(), adapter = createDemoRequestAdapter(sandbox, { app: "owner" });
  assert.deepEqual(await ok(adapter, "/api/owner/purchases", "POST", purchaseBody), purchase);
  assert.deepEqual(await ok(adapter, adjustPath, "POST", adjustBody), adjustment); assert.equal(sandbox.getSnapshot(), beforeReplay);
  const current = sandbox.getSnapshot().ingredients.find(row => row.id === ingredientId)!;
  assert.equal(current.stock_quantity, 8.5); assert.equal(current.cost_per_unit, 15);
  const history = record(await ok(request, `/api/owner/stock-movements?outlet_id=${T}&ingredient_id=${ingredientId}&page=1`));
  assert.equal(history.total, 4); assert.equal(history.page, 1); assert.equal(history.pageSize, 20);
  assert.deepEqual(rows(history.movements).map(row => row.type), ["purchase", "adjustment", "purchase", "adjustment"]);
  assert.ok(rows(history.movements).every(row => row.ingredient_name === "Sirup baru" && row.unit === "ml" && row.actor_name === "Owner Demo Rakku"));
  assert.ok(rows(history.movements).some(row => row.note === "Opening stock" && row.quantity_change === 10.25));
  const purchases = record(await ok(request, `/api/owner/purchases?outlet_id=${T}&page=1`)); assert.equal(purchases.total, 6);
  const mapped = findRow(rows(purchases.purchases), key(purchase.id)); assert.equal(mapped.supplier_name, purchaseBody.supplier); assert.equal(mapped.purchase_date, purchaseBody.date); assert.equal(mapped.actor_name, "Owner Demo Rakku");
  assert.deepEqual(rows(mapped.items)[0], { ingredient_id: ingredientId, ingredient_name: "Sirup baru", unit: "ml", quantity: 2.5, unit_cost: 12.34, subtotal: 30.85 });
  assert.equal(record(await ok(request, `/api/owner/purchases?outlet_id=${P}`)).total, 4);
  assert.deepEqual(sandbox.getSnapshot().ingredients.filter(row => row.outlet_id === P), pusatBefore);
  assert.deepEqual(other.sandbox.getSnapshot().ingredients.filter(row => row.outlet_id === P), pusatBefore);
  assert.equal(record(await ok(other.request, `/api/owner/purchases?outlet_id=${T}`)).total, 4);
  const page1 = record(await ok(request, `/api/owner/stock-movements?outlet_id=${T}&page=1`)), page2 = record(await ok(request, `/api/owner/stock-movements?outlet_id=${T}&page=2`));
  assert.equal(page1.total, page2.total); assert.equal(rows(page1.movements).length, 20); assert.equal(rows(page2.movements).length, 20);
  assert.ok(rows(page2.movements).every(row => !rows(page1.movements).some(first => first.id === row.id)));
  for (const [path, method, body, status] of [
    [adjustPath, "POST", { ...adjustBody, quantity: 8 }, 409],
    ["/api/owner/purchases", "POST", { ...purchaseBody, outlet_id: P }, 409],
    [adjustPath, "POST", { ...adjustBody, request_id: requestId(2) }, 409],
    [adjustPath, "POST", { ...adjustBody, outlet_id: P }, 403],
    [`/api/owner/stock-movements?outlet_id=${P}&ingredient_id=${ingredientId}`, "GET", undefined, 403],
    [`/api/owner/ingredients?id=${ingredientId}&outlet_id=${P}`, "DELETE", undefined, 403],
    [`/api/owner/stock-movements?outlet_id=${T}&page=0`, "GET", undefined, 400],
  ] as const) {
    const before = sandbox.getSnapshot(); assert.equal((await call(request, path, method, body)).response.status, status); assert.equal(sandbox.getSnapshot(), before);
  }
  assert.equal(sentinel.mock.callCount(), 0);
});

function findRow(values: Record<string, unknown>[], id: string) { const row = values.find(row => row.id === id); assert.ok(row); return row; }

test("Owner inventory rejects malformed purchases/counts atomically, protects movement history and edits negative-stock metadata", async () => {
  const { sandbox, request } = owner(); const ingredientId = id("ingredient", 0), adjustPath = `/api/owner/ingredients/${ingredientId}/adjust`;
  const base = { outlet_id: P, supplier: "Supplier", date: "2026-10-12", note: "Test", request_id: requestId(10), items: [{ ingredient_id: ingredientId, quantity: 1.25, unit_cost: 3.45 }] };
  for (const patch of [
    { items: [] }, { items: [base.items[0], base.items[0]] }, { items: [{ ...base.items[0], quantity: 0 }] },
    { items: [{ ...base.items[0], quantity: "2" }] }, { items: [{ ...base.items[0], quantity: 1.001 }] },
    { items: [{ ...base.items[0], unit_cost: 1.001 }] }, { items: [{ ...base.items[0], unit_cost: -1 }] },
    { items: [base.items[0], { ingredient_id: id("ingredient", 0, T), quantity: 1, unit_cost: 1 }] },
    { date: "2026-02-30" }, { date: "2026-10-13" }, { request_id: "not-a-uuid" },
  ]) {
    const before = sandbox.getSnapshot(); assert.ok(!(await call(request, "/api/owner/purchases", "POST", { ...base, ...patch })).response.ok); assert.equal(sandbox.getSnapshot(), before);
  }
  await ok(request, "/api/owner/purchases", "POST", base); // Failed attempts never reserve request_id.
  const halfCent = record(await ok(request, "/api/owner/purchases", "POST", { ...base, request_id: requestId(13), items: [{ ingredient_id: ingredientId, quantity: 1.5, unit_cost: 0.29 }] }));
  assert.equal(halfCent.total_amount, 0.44, "purchase decimal arithmetic rounds half cents exactly");
  for (const patch of [{ note: "" }, { note: "   " }, { quantity: -1 }, { quantity: "5" }, { request_id: "bad" }, { outlet_id: T }]) {
    const before = sandbox.getSnapshot(); const response = await call(request, adjustPath, "POST", { outlet_id: P, quantity: 5, note: "Valid", request_id: requestId(11), ...patch });
    assert.ok(!response.response.ok); assert.equal(sandbox.getSnapshot(), before);
  }
  sandbox.run({ type: "order.create", outlet_id: P, tier_id: id("tier", 0), items: [{ product_id: id("product", 0), quantity: 1000 }], status: "completed", payment_method: "cash" });
  const negative = sandbox.getSnapshot().ingredients.find(row => row.id === ingredientId)!.stock_quantity; assert.ok(negative < 0);
  await ok(request, "/api/owner/ingredients", "PATCH", { id: ingredientId, outlet_id: P, name: "Kopi diperbarui", unit: "gram", min_stock_alert: 25, cost_per_unit: 9, is_active: true });
  assert.equal(sandbox.getSnapshot().ingredients.find(row => row.id === ingredientId)!.stock_quantity, negative);
  const beforeDelete = sandbox.getSnapshot();
  assert.ok(!(await call(request, "/api/owner/ingredients", "PATCH", { id: ingredientId, outlet_id: P, unit: "kg" })).response.ok);
  assert.ok(!(await call(request, "/api/owner/ingredients", "PATCH", { id: ingredientId, outlet_id: P, stock_quantity: 0 })).response.ok);
  const deleted = await call(request, `/api/owner/ingredients?id=${ingredientId}&outlet_id=${P}`, "DELETE"); assert.match(String(record(deleted.data).error), /deactivate/); assert.equal(sandbox.getSnapshot(), beforeDelete);
  await ok(request, "/api/owner/ingredients", "PATCH", { id: ingredientId, outlet_id: P, is_active: false });
  const deactivated = sandbox.getSnapshot(); assert.deepEqual(deactivated.products, beforeDelete.products); assert.deepEqual(deactivated.movements, beforeDelete.movements);
  assert.ok(!(await call(request, "/api/owner/purchases", "POST", { ...base, request_id: requestId(12) })).response.ok); assert.equal(sandbox.getSnapshot(), deactivated);
  assert.ok(!(await call(request, "/api/owner/products", "PATCH", { id: id("product", 0), name: "Cannot save", recipes: [{ ingredient_id: ingredientId, quantity_used: 18 }] })).response.ok); assert.equal(sandbox.getSnapshot(), deactivated);
  await ok(request, "/api/owner/products", "PATCH", { id: id("product", 0), description: "Omitted recipe retains inactive references" });
  assert.ok(rows(record(await ok(request, `/api/owner/stock-movements?outlet_id=${P}&ingredient_id=${ingredientId}`)).movements).some(row => row.type === "sale_deduction"));
  const zero = record(await ok(request, "/api/owner/ingredients", "POST", { outlet_id: P, name: "Zero opening", unit: "pcs", stock_quantity: 0, min_stock_alert: 0, cost_per_unit: 0 }));
  const before = sandbox.getSnapshot(); assert.ok(!(await call(request, `/api/owner/ingredients?id=${zero.id}&outlet_id=${P}`, "DELETE")).response.ok);
  assert.ok(!(await call(request, "/api/owner/ingredients", "PATCH", { id: zero.id, outlet_id: P, unit: "gram" })).response.ok); assert.equal(sandbox.getSnapshot(), before);
});

test("Owner inventory/composition auth, quotas, receipt lifetime and network isolation remain local", async t => {
  const sentinel = t.mock.method(globalThis, "fetch", () => { throw new Error("network escape"); });
  const { sandbox, request } = owner();
  const body = { outlet_id: P, name: "Receipt product", category_id: id("category", 0), price: 1000, prices: [], recipes: [], request_id: requestId(20) };
  const created = record(await ok(request, "/api/owner/products", "POST", body));
  assert.ok(!("request_receipts" in sandbox.getSnapshot()));
  const purchase = { outlet_id: P, supplier: "Supplier", date: "2026-10-12", note: "Receipt", request_id: requestId(21), items: [{ ingredient_id: id("ingredient", 0), quantity: 1, unit_cost: 1 }] };
  await ok(request, "/api/owner/purchases", "POST", purchase);
  sandbox.run({ type: "session.cashier", outlet_id: P, employee_id: "fixture:rani_pusat", pin: "111111" });
  for (const [path, method, value] of [["/api/owner/products", "POST", body], ["/api/owner/purchases", "POST", purchase], [`/api/owner/ingredients?outlet_id=${P}`, "GET", undefined], [`/api/owner/stock-movements?outlet_id=${P}`, "GET", undefined]] as const) {
    const before = sandbox.getSnapshot(); assert.equal((await call(request, path, method, value)).response.status, 403); assert.equal(sandbox.getSnapshot(), before);
  }
  sandbox.run({ type: "session.logout", mode: "owner" });
  assert.equal((await call(request, "/api/owner/purchases", "POST", purchase)).response.status, 401);
  sandbox.run({ type: "session.owner" });
  const invoice = sandbox.run({ type: "subscription.checkout", plan: "free", billing_cycle: "monthly" }) as { id: string }; sandbox.run({ type: "subscription.transition", id: invoice.id, status: "success" });
  for (const [path, value] of [["/api/owner/purchases", { ...purchase, request_id: requestId(22) }], [`/api/owner/ingredients/${id("ingredient", 0)}/adjust`, { outlet_id: P, quantity: 1, note: "Gated", request_id: requestId(23) }], ["/api/owner/ingredients", { outlet_id: P, name: "Over quota", unit: "pcs", stock_quantity: 0 }]] as const) {
    const before = sandbox.getSnapshot(), result = await call(request, path, "POST", value); assert.equal(result.response.status, 403); assert.equal(record(result.data).code, "PLAN_LIMIT"); assert.equal(sandbox.getSnapshot(), before);
  }
  for (let n = sandbox.getSnapshot().products.length; n < 30; n++) await ok(request, "/api/owner/products", "POST", { ...body, name: `Quota ${n}`, request_id: requestId(100 + n) });
  const capped = sandbox.getSnapshot(); assert.equal((await call(request, "/api/owner/products", "POST", { ...body, request_id: requestId(200) })).response.status, 403); assert.equal(sandbox.getSnapshot(), capped);
  assert.equal(record(await ok(request, "/api/owner/products", "POST", body)).id, created.id); assert.equal(sandbox.getSnapshot(), capped);
  for (const path of ["https://live.invalid/api/owner/purchases", "//live.invalid/api/owner/stock-movements", "/api/owner/stock-movements/unknown", "/api/owner/ingredients/unknown/adjust/extra"]) assert.ok(!(await call(request, path, "POST", purchase)).response.ok);
  request.destroy(); const adapter = createDemoRequestAdapter(sandbox, { app: "owner" });
  assert.equal(record(await ok(adapter, "/api/owner/products", "POST", body)).id, created.id, "adapter disposal does not reset visitor receipts");
  sandbox.destroy(); await assert.rejects(adapter("/api/owner/purchases"), { name: "AbortError" });
  const fresh = owner(), replacement = record(await ok(fresh.request, "/api/owner/products", "POST", body)); assert.notEqual(replacement.id, created.id);
  assert.equal(sentinel.mock.callCount(), 0);
});
