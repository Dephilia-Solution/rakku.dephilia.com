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

test("Owner employee allOutlets, menus can_view matrix, status and PIN forms preserve assignment semantics", async () => {
  const { sandbox, request } = owner(); const role = record(record(await ok(request, "/api/owner/roles", "POST", { name: "New manager" })).role);
  const menus = rows(record(await ok(request, "/api/owner/menus")).menus);
  await ok(request, `/api/owner/roles/${role.id}/access`, "POST", { menuId: menus[0].id, canView: true });
  assert.deepEqual(record(await ok(request, `/api/owner/roles/${role.id}/access`)).menu_access, [menus[0].id]);
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
