import { test } from "node:test";
import assert from "node:assert/strict";
import type { PaymentIntent, SubscriptionInvoice, Withdrawal } from "@rakku/shared-types";
import { createDemoSandbox, DemoSandbox, jakartaDate, deriveBalance, productCost } from "../index";
import type { DemoCommand, DemoOrder, DemoProduct, DemoState, DemoEntity } from "./models";
import { DEMO_IDS, fixtureId } from "./fixture";
const NOW = new Date("2026-10-12T05:00:00Z");
const P = DEMO_IDS.pusat, T = DEMO_IDS.taman;
const id = (kind: string, key: number, outlet: string = P) => fixtureId(outlet, kind, key);
function owner(): DemoSandbox { const s = createDemoSandbox(NOW); s.run({ type: "session.owner" }); return s; }
function input(product = 4, quantity = 2, outlet: string = P) {
  return { outlet_id: outlet, tier_id: id("tier", 0, outlet), items: [{ product_id: id("product", product, outlet), quantity }] };
}
function create(s: DemoSandbox, status: "draft" | "completed" | "pending" = "completed", method: "cash" | "qris" | "qris_manual" | "card" = "cash"): DemoOrder {
  return s.run({ type: "order.create", ...input(), status, payment_method: method }) as DemoOrder;
}
function save<T = unknown>(s: DemoSandbox, entity: DemoEntity, value: Record<string, unknown>): T { return s.run({ type: "entity.save", entity, value }) as T; }
function cashier(s: DemoSandbox, manager = false, taman = false): void {
  s.run({ type: "session.cashier", outlet_id: taman ? T : P, employee_id: `fixture:${taman ? manager ? "dita_taman" : "raka_taman" : manager ? "rani_pusat" : "bima_pusat"}`, pin: taman ? manager ? "333333" : "444444" : manager ? "111111" : "222222" });
}
function stock(s: DemoSandbox, ingredient: number, outlet: string = P): number { return s.getSnapshot().ingredients.find(g => g.id === id("ingredient", ingredient, outlet))!.stock_quantity; }
function assertStockLedger(state: DemoState): void {
  for (const ingredient of state.ingredients) assert.ok(Math.abs(ingredient.stock_quantity - state.movements.filter(m => m.ingredient_id === ingredient.id).reduce((s, m) => s + m.quantity_change, 0)) < 0.000001, ingredient.name);
}
function assertBalance(state: DemoState): void {
  assert.deepEqual(state.balance, deriveBalance(state.ledger, state.company.id, state.now));
  let available = 0, pending = 0;
  const keys = new Set<string>();
  for (const l of state.ledger) {
    available += l.amount; pending += l.pending_delta;
    assert.equal(l.balance_after, available); assert.ok(available >= 0); assert.ok(pending >= 0);
    const key = `${l.type}:${l.reference_type}:${l.reference_id}`; assert.ok(!keys.has(key)); keys.add(key);
  }
  assert.equal(pending, state.withdrawals.filter(w => ["requested", "processing"].includes(w.status)).reduce((s, w) => s + w.amount, 0));
}
function invalid(s: DemoSandbox, cmd: unknown, pattern?: RegExp): void {
  const before = s.getSnapshot();
  if (pattern) assert.throws(() => s.run(cmd as DemoCommand), pattern); else assert.throws(() => s.run(cmd as DemoCommand));
  assert.equal(s.getSnapshot(), before, "failed commands must be atomic");
}

test("fixture is exact, deterministic, related, and stock/ledger reconciled", () => {
  const a = owner(), b = owner(), state = a.getSnapshot();
  assert.equal(state.company.name, "Rakku Demo Cafe"); assert.equal(state.company.code, "DEMO_CAFE");
  assert.equal(state.company.owner_name, "Owner Demo Rakku"); assert.equal(state.company.email, "owner@rakku.invalid"); assert.equal(state.company.password, "DemoCafe2026!");
  assert.deepEqual(state.employees.map(e => [e.name, e.username, e.pin, e.outlet_ids]), [
    ["Rani", "rani_pusat", "111111", [P]], ["Bima", "bima_pusat", "222222", [P]], ["Dita", "dita_taman", "333333", [T]], ["Raka", "raka_taman", "444444", [T]],
  ]);
  assert.equal(state.outlets.length, 2); assert.equal(state.plan, "business"); assert.equal(state.ingredients.length, 30); assert.equal(state.products.length, 20);
  const targetP = [6000, 20000, 5000, 150, 2000, 500, 5000, 2000, 50000, 20000, 40, 8000, 5000, 2000, 1000];
  const targetT = [4000, 14000, 3500, 500, 1500, 350, 3000, 1500, 35000, 15000, 6, 5000, 3500, 1500, 750];
  for (const outlet of state.outlets) {
    const products = state.products.filter(p => p.outlet_id === outlet.id);
    assert.equal(products.length, 10); assert.equal(state.categories.filter(c => c.outlet_id === outlet.id).length, 3);
    assert.deepEqual(state.ingredients.filter(g => g.outlet_id === outlet.id).map(g => g.stock_quantity), outlet.id === P ? targetP : targetT);
    const orders = state.orders.filter(o => o.outlet_id === outlet.id);
    assert.equal(orders.filter(o => o.status === "completed").length, 60);
    assert.equal(orders.filter(o => o.status === "draft").length, 2); assert.equal(orders.filter(o => o.status === "pending_payment").length, 1); assert.equal(orders.filter(o => o.status === "cancelled").length, 1);
    assert.equal(new Set(orders.filter(o => o.status === "completed").map(o => jakartaDate(o.created_at))).size, 30);
    assert.equal(orders.filter(o => o.status === "completed" && jakartaDate(o.created_at) === jakartaDate(state.now)).length, 2);
    assert.equal(state.tables.filter(t => t.outlet_id === outlet.id).length, 8); assert.equal(state.tables.filter(t => t.outlet_id === outlet.id && t.status === "occupied").length, 3);
    assert.equal(state.purchases.filter(p => p.outlet_id === outlet.id).length, 4); assert.equal(state.expenses.filter(e => e.outlet_id === outlet.id).length, 6);
    assert.equal(state.movements.filter(m => m.outlet_id === outlet.id && m.note === "Stock opname simulasi").length, 2);
    for (const product of products) {
      assert.ok(state.categories.some(c => c.id === product.category_id && c.outlet_id === outlet.id));
      for (const recipe of product.recipe) assert.ok(state.ingredients.some(g => g.id === recipe.ingredient_id && g.outlet_id === outlet.id));
      for (const tier of state.tiers.filter(t => t.outlet_id === outlet.id)) assert.ok(Number.isInteger(product.prices[tier.id]));
    }
  }
  for (const ingredient of state.ingredients) assert.equal(state.movements.filter(m => m.ingredient_id === ingredient.id && m.note === "Opening stock").length, 1);
  for (const purchase of state.purchases) assert.equal(purchase.total_amount, purchase.items.reduce((s, i) => s + i.subtotal, 0));
  for (const order of state.orders) {
    assert.equal(order.total, order.total_price);
    assert.equal(order.subtotal, order.items.reduce((s, i) => s + i.subtotal, 0));
    for (const item of order.items) assert.equal(item.order_id, order.id);
  }
  assertStockLedger(state); assertBalance(state); assert.equal(a.report().orders, 120);
  const totals = a.report();
  assert.deepEqual({ revenue: totals.revenue, cogs: totals.cogs, expenses: totals.expenses, subtotal: totals.subtotal, tax: totals.tax, discounts: totals.discounts },
    // Seed modifiers add Rp216,000 before Rp8,400 additional Matcha discounts;
    // BOM-only HPP is unchanged. Tax is 10% of the discounted item subtotal.
    { revenue: 11155980, cogs: 1998180, expenses: 750000, subtotal: 10141800, tax: 1014180, discounts: 136200 });
  assert.deepEqual({ ...state, generation: "same" }, { ...b.getSnapshot(), generation: "same" });
});

test("Jakarta fixture dates stay relative at midnight, year/month boundaries, and leap day", () => {
  for (const value of ["2026-10-11T17:00:00Z", "2027-01-01T00:02:00+07:00", "2028-02-29T00:00:00+07:00"]) {
    const s = createDemoSandbox(new Date(value)); s.run({ type: "session.owner" }); const state = s.getSnapshot();
    assert.equal(state.orders.filter(o => o.status === "completed" && jakartaDate(o.created_at) === jakartaDate(state.now)).length, 4);
    assert.ok(state.orders.every(o => Date.parse(o.created_at) <= Date.parse(state.now)));
    assertStockLedger(state); assertBalance(state);
  }
  assert.equal(jakartaDate("2026-10-11T17:00:00Z"), "2026-10-12");
});

test("snapshots and nested command results are frozen, cached, subscribed only on changes", () => {
  const s = owner(); let events = 0;
  const unsubscribe = s.subscribe(() => events++), before = s.getSnapshot();
  assert.equal(s.getSnapshot(), before); assert.ok(Object.isFrozen(before.products[0].recipe));
  assert.throws(() => { before.products[0].prices[id("tier", 0)] = 1; });
  const q = s.run({ type: "order.quote", ...input() }) as DemoOrder;
  assert.ok(Object.isFrozen(q.items)); assert.equal(s.getSnapshot(), before); assert.equal(events, 0);
  create(s, "draft"); assert.equal(events, 1); assert.notEqual(s.getSnapshot(), before);
  s.run({ type: "session.owner" }); assert.equal(events, 1);
  unsubscribe(); s.run({ type: "tick" }); assert.equal(events, 1);
  s.subscribe(() => { throw new Error("listener failure"); }); s.subscribe(() => events++);
  s.run({ type: "tick" }); assert.equal(events, 2);
});

test("independent visitors cannot reuse generated IDs or mutate each other", () => {
  const a = owner(), b = owner(), beforeB = b.getSnapshot();
  const order = create(a, "draft"); assert.ok(order.id.startsWith(a.generation)); assert.notEqual(a.generation, b.generation);
  invalid(b, { type: "order.complete", id: order.id, payment_method: "cash" }, /Resource not found/);
  const product = save<DemoProduct>(a, "products", { outlet_id: P, name: "Visitor A", category_id: id("category", 0), price: 10000 });
  invalid(b, { type: "entity.save", entity: "products", value: { id: product.id, name: "Cross visitor" } });
  assert.equal(b.getSnapshot(), beforeB);
  assert.doesNotThrow(() => b.run({ type: "order.quote", ...input() }));
});

test("destroy and generations reject stale callbacks and new state is untouched", () => {
  const a = owner(), b = owner(), before = b.getSnapshot(), command = { type: "tick" } as const;
  assert.throws(() => b.run(command, a.generation), /Stale/); assert.equal(b.getSnapshot(), before);
  let called = 0; const unsubscribe = a.subscribe(() => called++); const callback = () => a.run(command, a.generation);
  a.destroy(); a.destroy(); unsubscribe(); assert.throws(callback, /destroyed/);
  assert.throws(() => a.getSnapshot(), /destroyed/); assert.throws(() => a.subscribe(() => {}), /destroyed/);
  assert.throws(() => a.publicMenu(P), /destroyed/); assert.throws(() => a.report(), /destroyed/); assert.equal(called, 0); assert.equal(b.getSnapshot(), before);
});

test("public menu is safe, filtered and validates outlets without login", () => {
  const s = createDemoSandbox(NOW), menu = s.publicMenu(P);
  assert.equal(menu.outletName, "Rakku Demo Cafe — Pusat"); assert.equal(menu.categories.flatMap(c => c.products).length, 10);
  assert.deepEqual(Object.keys(menu.categories[0].products[0]).sort(), ["description", "id", "image_url", "name", "price"]);
  assert.ok(Object.isFrozen(menu.categories[0].products)); assert.throws(() => s.publicMenu("invalid"));
  s.run({ type: "session.owner" }); save(s, "products", { id: id("product", 0), is_active: false });
  assert.equal(s.publicMenu(P).categories.flatMap(c => c.products).length, 9);
  save(s, "outlets", { id: P, is_active: false }); assert.throws(() => s.publicMenu(P), /inactive/);
  assert.equal(s.report(P).orders, 60, "owner retains inactive-outlet history");
});

test("owner/POS read projections and every business boundary enforce menus and scope", () => {
  const s = createDemoSandbox(NOW);
  assert.equal(s.getSnapshot().session.authenticated, false); assert.equal(s.getSnapshot().products.length, 0);
  assert.ok(s.getSnapshot().employees.every(e => !e.pin)); assert.equal(s.getSnapshot().company.password, "");
  invalid(s, { type: "order.quote", ...input() }, /Authentication/); assert.throws(() => s.report(), /Authentication/);
  cashier(s); let snap = s.getSnapshot();
  assert.equal(snap.products.length, 10); assert.equal(snap.ingredients.length, 0); assert.ok(snap.products.every(p => !p.recipe.length));
  assert.equal(snap.roles.length, 0); assert.equal(snap.employees.length, 0); assert.equal(snap.banks.length, 0); assert.equal(snap.balance, null); assert.equal(snap.invoices.length, 0);
  assert.equal(snap.company.password, ""); assert.equal(snap.company.email, ""); assert.equal(s.report().orders, 60);
  assert.throws(() => s.report(T), /Outlet access/);
  for (const entity of ["roles", "employees", "banks", "outlets", "products", "ingredients", "expenses", "tables"] as DemoEntity[]) invalid(s, { type: "entity.save", entity, value: { name: "Forbidden" } }, /Owner|permission/);
  invalid(s, { type: "company.save", value: {} }, /Owner/); invalid(s, { type: "withdrawal.create", bank_id: "fixture:bank:0", amount: 50000 }, /Owner/);
  invalid(s, { type: "subscription.checkout", plan: "free", billing_cycle: "monthly" }, /Owner/);
  invalid(s, { type: "stock.adjust", ingredient_id: id("ingredient", 0), quantity: 0, note: "bad" }, /permission/);
  invalid(s, { type: "purchase.create", outlet_id: P, supplier_name: "x", note: "", items: [] }, /permission/);
  invalid(s, { type: "order.quote", ...input(4, 1, T) }, /Outlet access/);
  save(s, "taxes", { id: id("tax", 1), is_active: true });
  cashier(s, true); snap = s.getSnapshot(); assert.equal(snap.ingredients.length, 15); assert.ok(snap.products[0].recipe.length); assert.equal(snap.purchases.length, 4);
  invalid(s, { type: "entity.save", entity: "ingredients", value: { id: id("ingredient", 0, T), name: "Cross scope" } }, /Outlet access/);
  s.run({ type: "session.owner" }); assert.equal(s.getSnapshot().products.length, 20); assert.equal(s.getSnapshot().ingredients.length, 30);
  save(s, "roles", { id: DEMO_IDS.cashier, menus: ["orders"] }); cashier(s);
  assert.equal(s.getSnapshot().products.length, 0); assert.throws(() => s.report(), /permission/);
  invalid(s, { type: "order.quote", ...input() }, /permission/);
});

test("cashier assignment, PIN, outlet switching, and owner edits invalidate sessions", () => {
  const s = owner();
  invalid(s, { type: "session.cashier", outlet_id: T, employee_id: "fixture:rani_pusat", pin: "111111" });
  invalid(s, { type: "session.cashier", outlet_id: P, employee_id: "fixture:rani_pusat", pin: "wrong" });
  invalid(s, { type: "session.cashier", outlet_id: "invalid", employee_id: "fixture:rani_pusat", pin: "111111" });
  cashier(s); const before = s.getSnapshot(); s.run({ type: "session.selectOutlet", outlet_id: P }); assert.equal(s.getSnapshot(), before);
  s.run({ type: "session.selectOutlet", outlet_id: T }); assert.equal(s.getSnapshot().session.employee_id, null); assert.equal(s.getSnapshot().session.authenticated, false);
  cashier(s, false, true); s.run({ type: "session.switchUser" }); assert.equal(s.getSnapshot().session.mode, "pos"); assert.equal(s.getSnapshot().session.outlet_id, T);
  s.run({ type: "session.owner" }); save(s, "employees", { id: "fixture:rani_pusat", outlet_ids: [P, T] }); cashier(s, true);
  s.run({ type: "session.selectOutlet", outlet_id: T }); assert.equal(s.getSnapshot().session.employee_id, "fixture:rani_pusat"); assert.equal(s.getSnapshot().session.authenticated, true);
  s.run({ type: "session.owner" }); save(s, "employees", { id: "fixture:bima_pusat", is_active: false });
  invalid(s, { type: "session.cashier", outlet_id: P, employee_id: "fixture:bima_pusat", pin: "222222" });
});

test("quote uses exact four-tier prices, modifiers, active/expired discounts and tax", () => {
  const s = owner();
  const prices = [[18, 22], [22, 27], [28, 34], [30, 36], [26, 32], [32, 39], [28, 34], [20, 25], [24, 29], [24, 29]];
  for (const [i, p] of prices.entries()) for (let tier = 0; tier < 4; tier++) {
    const q = s.run({ type: "order.quote", ...input(i, 1), tier_id: id("tier", tier) }) as DemoOrder;
    assert.equal(q.items[0].unit_price, p[tier > 1 ? 1 : 0] * 1000);
  }
  const q = s.run({ type: "order.quote", ...input(), items: [{ product_id: id("product", 4), quantity: 2, modifier_ids: [id("modifier:4", 0), id("modifier:4", 1)], note: "Less ice" }] }) as DemoOrder;
  assert.equal(q.items[0].unit_price, 34000); assert.equal(q.subtotal, 68000); assert.equal(q.tax_amount, 6800); assert.equal(q.total, 74800); assert.equal(q.items[0].note, "Less ice"); assert.match(q.items[0].modifier_label!, /Extra Shot/);
  const matcha = s.run({ type: "order.quote", ...input(5, 2) }) as DemoOrder;
  assert.equal(matcha.discount_amount, 6400); assert.equal(matcha.subtotal, 57600); assert.equal(matcha.tax_amount, 5760); assert.equal(matcha.total, 63360);
  save(s, "discounts", { id: id("discount", 1), is_active: true }); save(s, "taxes", { id: id("tax", 1), is_active: true });
  const promo = s.run({ type: "order.quote", ...input() }) as DemoOrder;
  assert.equal(promo.discount_amount, 5000); assert.equal(promo.tax_amount, 5700); assert.equal(promo.total, 52700);
});

test("two Kopi Susu consume exact coffee/milk/aren/water/ice amounts only once", () => {
  const s = owner(), before = s.getSnapshot(), o = create(s);
  const expected = new Map([[0, 36], [1, 300], [2, 50], [8, 60], [9, 200]]);
  for (let i = 0; i < 15; i++) assert.equal(stock(s, i), before.ingredients.find(g => g.id === id("ingredient", i))!.stock_quantity - (expected.get(i) ?? 0));
  assert.equal(o.total, 57200); assert.equal(o.status, "completed");
  const movements = s.getSnapshot().movements.filter(m => m.reference_id === o.id); assert.equal(movements.length, 5);
  for (const m of movements) assert.equal(m.quantity_change, -expected.get(Number(m.ingredient_id.split(":").at(-1)))!);
  const once = s.getSnapshot(); s.run({ type: "order.complete", id: o.id, payment_method: "cash" }); assert.equal(s.getSnapshot(), once);
  assertStockLedger(s.getSnapshot());
});

test("drafts never deduct; completion/splits/cash change are atomic and idempotent", () => {
  const s = owner(), before = stock(s, 0), draft = create(s, "draft"); assert.equal(stock(s, 0), before);
  invalid(s, { type: "order.complete", id: draft.id, payment_method: "cash", amount_paid: 100 });
  invalid(s, { type: "order.complete", id: draft.id, payment_method: "cash", splits: [{ method: "cash", amount: 1 }, { method: "card", amount: 1 }] });
  invalid(s, { type: "payment.create", order_id: draft.id });
  const o = s.run({ type: "order.complete", id: draft.id, payment_method: "cash", splits: [{ method: "cash", amount: 20000 }, { method: "card", amount: draft.total - 20000 }] }) as DemoOrder;
  assert.equal(o.split_bill, true); assert.equal(o.splits.length, 2); assert.equal(stock(s, 0), before - 36);
  const after = s.getSnapshot(); s.run({ type: "order.complete", id: o.id, payment_method: "cash" }); assert.equal(s.getSnapshot(), after);
  invalid(s, { type: "payment.create", order_id: o.id }); invalid(s, { type: "order.cancel", id: o.id });
  const cash = s.run({ type: "order.create", ...input(), status: "completed", payment_method: "cash", amount_paid: 60000 }) as DemoOrder;
  assert.equal(cash.change, 2800); assert.equal(cash.amount_paid, 60000);
  assertStockLedger(s.getSnapshot());
});

test("purchase updates last cost, absolute opname, low stock and failed purchases reconcile", () => {
  const s = owner(); assert.ok(stock(s, 3) < s.getSnapshot().ingredients.find(g => g.id === id("ingredient", 3))!.min_stock_alert);
  const purchase = s.run({ type: "purchase.create", outlet_id: P, supplier_name: "Demo", note: "Test", items: [{ ingredient_id: id("ingredient", 3), quantity: 100, unit_cost: 550 }, { ingredient_id: id("ingredient", 0), quantity: 200, unit_cost: 130 }] }) as DemoState["purchases"][number];
  assert.equal(purchase.total_amount, 81000); assert.equal(stock(s, 3), 250); assert.equal(s.getSnapshot().ingredients.find(g => g.id === id("ingredient", 3))!.cost_per_unit, 550);
  s.run({ type: "stock.adjust", ingredient_id: id("ingredient", 3), quantity: 25, note: "Counted 25" }); assert.equal(stock(s, 3), 25);
  assert.equal(s.getSnapshot().movements.at(-1)!.quantity_change, -225);
  invalid(s, { type: "purchase.create", outlet_id: P, supplier_name: "Demo", note: "", items: [{ ingredient_id: id("ingredient", 0), quantity: 100, unit_cost: 1 }, { ingredient_id: id("ingredient", 0, T), quantity: 100, unit_cost: 1 }] });
  invalid(s, { type: "stock.adjust", ingredient_id: id("ingredient", 0), quantity: -1, note: "bad" });
  s.run({ type: "stock.adjust", ingredient_id: id("ingredient", 3), quantity: 25.1234567, note: "Fractional count" });
  assert.equal(stock(s, 3), 25.1234567);
  assertStockLedger(s.getSnapshot());
});

test("dynamic QRIS success deducts and credits net MDR exactly once; manual never credits", () => {
  const s = owner(), balance = s.getSnapshot().balance!, beforeCoffee = stock(s, 0), order = create(s, "pending", "qris");
  assert.equal(stock(s, 0), beforeCoffee);
  const payment = s.run({ type: "payment.create", order_id: order.id }) as PaymentIntent;
  assert.equal(payment.provider, "demo"); assert.match(payment.qr_string!, /NOT-PAYABLE/); assert.equal(payment.amount, 57200);
  const snapshot = s.getSnapshot(); s.run({ type: "payment.create", order_id: order.id }); assert.equal(s.getSnapshot(), snapshot);
  s.run({ type: "payment.transition", id: payment.id, status: "success" });
  assert.equal(stock(s, 0), beforeCoffee - 36); const after = s.getSnapshot();
  assert.equal(after.orders.find(o => o.id === order.id)!.status, "completed");
  assert.equal(after.balance!.available_balance, balance.available_balance + 57200 - Math.round(57200 * 0.007));
  assert.equal(after.balance!.total_fees, balance.total_fees + 400);
  s.run({ type: "payment.transition", id: payment.id, status: "success" }); assert.equal(s.getSnapshot(), after);
  invalid(s, { type: "payment.transition", id: payment.id, status: "failed" });
  create(s, "completed", "qris_manual"); assert.equal(s.getSnapshot().balance!.available_balance, after.balance!.available_balance);
  assertBalance(s.getSnapshot()); assertStockLedger(s.getSnapshot());
});

test("QRIS failure/expiry/cancel/retry, old intent rejection and manual fallback", () => {
  const s = owner(), o = create(s, "pending", "qris"), before = stock(s, 0), balance = s.getSnapshot().balance!.available_balance;
  const p = s.run({ type: "payment.create", order_id: o.id }) as PaymentIntent;
  s.run({ type: "payment.transition", id: p.id, status: "failed" }); assert.equal(stock(s, 0), before);
  const retry = s.run({ type: "payment.retry", id: p.id }) as PaymentIntent; assert.notEqual(retry.id, p.id);
  invalid(s, { type: "payment.transition", id: p.id, status: "success" }); invalid(s, { type: "payment.retry", id: p.id }, /Stale/);
  s.run({ type: "tick", now: retry.expired_at! }); assert.equal(s.getSnapshot().payments.find(x => x.id === retry.id)!.status, "expired");
  assert.equal(s.getSnapshot().orders.find(x => x.id === o.id)!.status, "pending_payment"); assert.equal(stock(s, 0), before); assert.equal(s.getSnapshot().balance!.available_balance, balance);
  invalid(s, { type: "payment.transition", id: retry.id, status: "success" });
  const retry2 = s.run({ type: "payment.retry", id: retry.id }) as PaymentIntent;
  s.run({ type: "order.complete", id: o.id, payment_method: "qris_manual" }); assert.equal(s.getSnapshot().payments.find(x => x.id === retry2.id)!.status, "cancelled");
  assert.equal(stock(s, 0), before - 36); assert.equal(s.getSnapshot().balance!.available_balance, balance);
  const cancelledOrder = create(s, "pending", "qris"), cancelled = s.run({ type: "payment.create", order_id: cancelledOrder.id }) as PaymentIntent;
  s.run({ type: "order.cancel", id: cancelledOrder.id }); invalid(s, { type: "payment.transition", id: cancelled.id, status: "success" });
  assertStockLedger(s.getSnapshot()); assertBalance(s.getSnapshot());
});

test("withdrawal holds, processing, rejection/refund and completion are nonnegative/idempotent", () => {
  const s = owner(), pending = s.getSnapshot().withdrawals.find(w => w.status === "requested")!;
  invalid(s, { type: "withdrawal.create", bank_id: "fixture:bank:0", amount: 50000 }, /pending/);
  const before = s.getSnapshot().balance!; s.run({ type: "withdrawal.transition", id: pending.id, status: "rejected", note: "Test rejection" });
  assert.equal(s.getSnapshot().balance!.available_balance, before.available_balance + pending.amount); assert.equal(s.getSnapshot().balance!.pending_balance, 0);
  const available = s.getSnapshot().balance!.available_balance;
  const w = s.run({ type: "withdrawal.create", bank_id: "fixture:bank:0", amount: 50000 }) as Withdrawal;
  assert.equal(w.fee, 0); assert.equal(w.net_amount, 50000); assert.equal(s.getSnapshot().balance!.available_balance, available - 50000); assert.equal(s.getSnapshot().balance!.pending_balance, 50000);
  s.run({ type: "withdrawal.transition", id: w.id, status: "processing" }); s.run({ type: "withdrawal.transition", id: w.id, status: "completed" });
  assert.equal(s.getSnapshot().balance!.pending_balance, 0); assert.equal(s.getSnapshot().balance!.total_withdrawn, before.total_withdrawn + 50000);
  const after = s.getSnapshot(); s.run({ type: "withdrawal.transition", id: w.id, status: "completed" }); assert.equal(s.getSnapshot(), after);
  invalid(s, { type: "withdrawal.transition", id: w.id, status: "rejected" });
  invalid(s, { type: "withdrawal.create", bank_id: "fixture:bank:0", amount: 49999 });
  invalid(s, { type: "withdrawal.create", bank_id: "fixture:bank:0", amount: 10000001 }, /Daily/);
  invalid(s, { type: "withdrawal.create", bank_id: "fixture:bank:0", amount: available + 100000 }, /balance/);
  invalid(s, { type: "withdrawal.create", bank_id: "missing", amount: 50000 }); assertBalance(s.getSnapshot());
});

test("reports recompute current recipe and last ingredient cost, and filter inclusive Jakarta dates", () => {
  const s = owner(), before = s.report(P), all = s.report(); assert.equal(all.orders, 120); assert.equal(before.orders, 60);
  assert.equal(all.revenue, s.report(P).revenue + s.report(T).revenue);
  assert.equal(before.grossProfit, before.revenue - before.cogs); assert.equal(before.netProfit, before.grossProfit - before.expenses);
  const coffeeQuantity = s.getSnapshot().orders.filter(o => o.outlet_id === P && o.status === "completed").reduce((sum, order) => sum + order.items.reduce((sum, item) => sum + s.getSnapshot().products.find(p => p.id === item.product_id)!.recipe.filter(r => r.ingredient_id === id("ingredient", 0)).reduce((sum, r) => sum + r.quantity_used * item.quantity, 0), 0), 0);
  s.run({ type: "purchase.create", outlet_id: P, supplier_name: "Cost change", note: "", items: [{ ingredient_id: id("ingredient", 0), quantity: 1, unit_cost: 150 }] });
  assert.equal(s.report(P).cogs, before.cogs + coffeeQuantity * 30); assert.equal(s.report(P).revenue, before.revenue);
  const product = s.getSnapshot().products.find(p => p.id === id("product", 4))!; const beforeRecipe = s.report(P).cogs;
  const sold = s.report(P).products.find(p => p.product_id === product.id)!.quantity;
  save(s, "products", { id: product.id, recipe: product.recipe.map(r => ({ ...r, quantity_used: r.quantity_used * 2 })) });
  assert.equal(s.report(P).cogs, beforeRecipe + productCost(product, s.getSnapshot()) * sold);
  const today = jakartaDate(s.getSnapshot().now); assert.equal(s.report(P, today, today).orders, 2);
  assert.throws(() => s.report(P, "2026-02-30", today)); assert.throws(() => s.report(P, today, "2026-01-01")); assert.throws(() => s.report("missing"));
});

test("subscription terminal transitions, retry/expiry, activation once and downgrade preservation", () => {
  const s = owner();
  let invoice = s.run({ type: "subscription.checkout", plan: "pro", billing_cycle: "yearly" }) as SubscriptionInvoice;
  assert.equal(invoice.amount, 990000); assert.equal(s.getSnapshot().plan, "business");
  s.run({ type: "subscription.transition", id: invoice.id, status: "failed" }); invalid(s, { type: "subscription.transition", id: invoice.id, status: "success" });
  invoice = s.run({ type: "subscription.retry", id: invoice.id }) as SubscriptionInvoice;
  s.run({ type: "tick", now: invoice.expired_at! }); assert.equal(s.getSnapshot().invoices.find(i => i.id === invoice.id)!.status, "expired");
  invoice = s.run({ type: "subscription.retry", id: invoice.id }) as SubscriptionInvoice;
  s.run({ type: "subscription.transition", id: invoice.id, status: "success" }); assert.equal(s.getSnapshot().plan, "pro");
  const once = s.getSnapshot(); s.run({ type: "subscription.transition", id: invoice.id, status: "success" }); assert.equal(s.getSnapshot(), once);
  const free = s.run({ type: "subscription.checkout", plan: "free", billing_cycle: "monthly" }) as SubscriptionInvoice;
  const data = s.getSnapshot(); s.run({ type: "subscription.transition", id: free.id, status: "success" });
  assert.equal(s.getSnapshot().plan, "free"); assert.deepEqual(s.getSnapshot().products, data.products); assert.deepEqual(s.getSnapshot().ingredients, data.ingredients); assert.deepEqual(s.getSnapshot().orders, data.orders);
  invalid(s, { type: "entity.save", entity: "outlets", value: { name: "Over quota" } }, /PLAN_LIMIT/);
  invalid(s, { type: "entity.save", entity: "employees", value: { name: "Over quota" } }, /PLAN_LIMIT/);
  invalid(s, { type: "entity.save", entity: "ingredients", value: { name: "Over quota" } }, /PLAN_LIMIT/);
  invalid(s, { type: "entity.save", entity: "roles", value: { name: "Over quota", menus: [] } }, /PLAN_LIMIT/);
  save(s, "products", { id: id("product", 0), name: "Existing editable after downgrade" }); assert.equal(s.publicMenu(P).categories[0].products[0].name, "Existing editable after downgrade");
  assert.throws(() => s.report(), /profit_loss/); invalid(s, { type: "subscription.checkout", plan: "unknown", billing_cycle: "monthly" });
});

test("Free email preview is feature-blocked; Pro permits exactly 100 reports and resets quota in Jakarta", () => {
  const s = owner(), invoice = s.run({ type: "subscription.checkout", plan: "free", billing_cycle: "monthly" }) as SubscriptionInvoice;
  s.run({ type: "subscription.transition", id: invoice.id, status: "success" });
  invalid(s, { type: "email.preview", to: "demo@rakku.invalid" }, /PLAN_LIMIT: email_reports$/);
  assert.equal(s.getSnapshot().outbox.filter(mail => mail.kind === "report").length, 0);
  const pro = s.run({ type: "subscription.checkout", plan: "pro", billing_cycle: "yearly" }) as SubscriptionInvoice;
  s.run({ type: "subscription.transition", id: pro.id, status: "success" });
  invalid(s, { type: "email.preview", to: "invalid" }, /Invalid email/);
  for (let i = 0; i < 100; i++) {
    const mail = s.run({ type: "email.preview", to: "demo@rakku.invalid" }) as DemoState["outbox"][number];
    assert.equal(mail.status, "simulated"); assert.match(mail.body, /tidak dikirim/); assert.ok(mail.kind === "report"); assert.equal(mail.report.orders, 120);
  }
  invalid(s, { type: "email.preview", to: "demo@rakku.invalid" }, /PLAN_LIMIT: email_reports_month/);
  s.run({ type: "tick", now: "2026-10-31T16:59:59.999Z" });
  invalid(s, { type: "email.preview", to: "demo@rakku.invalid" }, /email_reports_month/);
  s.run({ type: "tick", now: "2026-10-31T17:00:00Z" }); assert.doesNotThrow(() => s.run({ type: "email.preview", to: "demo@rakku.invalid" }));
  assert.equal(s.getSnapshot().outbox.filter(mail => mail.kind === "report").length, 101);
  assert.equal(s.getSnapshot().outbox.filter(mail => mail.kind === "system").length, 2);
});

test("tick expires drafts safely, releases their tables and never settles a payment", () => {
  const s = owner(), table = id("table", 4);
  const draft = s.run({ type: "order.create", ...input(), table_id: table, status: "draft", payment_method: "cash" }) as DemoOrder;
  assert.equal(s.getSnapshot().tables.find(t => t.id === table)!.status, "occupied");
  const before = s.getSnapshot().balance!.available_balance, coffee = stock(s, 0);
  s.run({ type: "tick", now: draft.reserved_until! });
  assert.equal(s.getSnapshot().orders.find(o => o.id === draft.id)!.status, "cancelled"); assert.equal(s.getSnapshot().tables.find(t => t.id === table)!.status, "available");
  assert.equal(stock(s, 0), coffee); assert.equal(s.getSnapshot().balance!.available_balance, before);
  invalid(s, { type: "order.complete", id: draft.id, payment_method: "cash" });
  invalid(s, { type: "tick", now: NOW.toISOString() }); invalid(s, { type: "tick", now: "2026-02-30T00:00:00Z" });
  // Reusing a manually released, previously completed table must not prevent
  // the subsequent reservation from being released on cancellation.
  s.run({ type: "order.create", ...input(), table_id: table, status: "completed", payment_method: "cash" });
  save(s, "tables", { id: table, status: "available" });
  const reused = s.run({ type: "order.create", ...input(), table_id: table, status: "draft", payment_method: "cash" }) as DemoOrder;
  s.run({ type: "order.cancel", id: reused.id }); assert.equal(s.getSnapshot().tables.find(t => t.id === table)!.status, "available");
});

test("entity CRUD whitelist, relations, monetary/date/unit checks and unique username/PIN", () => {
  const s = owner();
  const invalidValues: [DemoEntity, Record<string, unknown>][] = [
    ["products", { id: id("product", 0), company_id: "foreign" }], ["products", { id: id("product", 0), outlet_id: T }],
    ["products", { id: id("product", 0), category_id: id("category", 0, T) }], ["products", { id: id("product", 0), prices: { [id("tier", 0, T)]: 1 } }],
    ["products", { id: id("product", 0), recipe: [{ ingredient_id: id("ingredient", 0, T), quantity_used: 1 }] }],
    ["products", { id: id("product", 0), price: -1 }], ["products", { id: id("product", 0), image_url: "https://provider.invalid/image" }],
    ["ingredients", { id: id("ingredient", 0), unit: "invalid" }], ["ingredients", { id: id("ingredient", 0), stock_quantity: 1 }],
    ["employees", { id: "fixture:rani_pusat", username: "bima_pusat" }], ["employees", { id: "fixture:rani_pusat", pin: "222222" }],
    ["employees", { id: "fixture:rani_pusat", pin: "12345" }], ["employees", { id: "fixture:rani_pusat", outlet_ids: [] }],
    ["employees", { id: "fixture:rani_pusat", role_id: "missing" }], ["employees", { id: "fixture:rani_pusat", outlet_ids: ["missing"] }],
    ["roles", { id: DEMO_IDS.manager, menus: ["balance"] }], ["taxes", { id: id("tax", 0), value: 101 }],
    ["discounts", { id: id("discount", 0), start_date: "2026-02-30" }], ["discounts", { id: id("discount", 0), end_date: "2020-01-01" }],
    ["expenses", { outlet_id: P, category: "x", amount: NaN }], ["expenses", { outlet_id: P, category: "x", amount: 1, expense_date: "2099-01-01" }],
  ];
  for (const [entity, value] of invalidValues) invalid(s, { type: "entity.save", entity, value });
  const product = save<DemoProduct>(s, "products", { outlet_id: P, category_id: id("category", 0), name: "New product", price: 10000, unsafe: "ignored", recipe: [], modifiers: [] });
  assert.ok(!("unsafe" in product)); assert.ok(!("unsafe" in s.getSnapshot().products.find(p => p.id === product.id)!));
  const role = save<{ id: string }>(s, "roles", { name: "Read Orders", menus: ["orders"] });
  const employee = save<{ id: string }>(s, "employees", { name: "New Employee", username: "new_employee", role_id: role.id, pin: "555555", outlet_ids: [P] });
  invalid(s, { type: "entity.delete", entity: "roles", id: role.id });
  s.run({ type: "entity.delete", entity: "employees", id: employee.id }); s.run({ type: "entity.delete", entity: "roles", id: role.id });
  s.run({ type: "entity.delete", entity: "products", id: product.id });
  for (const [entity, key] of [["products", id("product", 0)], ["ingredients", id("ingredient", 0)], ["categories", id("category", 0)], ["tiers", id("tier", 0)], ["banks", "fixture:bank:0"], ["outlets", P], ["tables", id("table", 1)]] as [DemoEntity, string][]) invalid(s, { type: "entity.delete", entity, id: key }, /referenced/);
  invalid(s, { type: "entity.save", entity: "company", value: {} });
});

test("new ingredients opening stock, tables generation, reorder and company/password commands", () => {
  const s = owner();
  const ingredient = save<{ id: string }>(s, "ingredients", { outlet_id: P, name: "New ingredient", unit: "kg", stock_quantity: 3, min_stock_alert: 1, cost_per_unit: 10000 });
  assertStockLedger(s.getSnapshot()); s.run({ type: "entity.delete", entity: "ingredients", id: ingredient.id }); assertStockLedger(s.getSnapshot());
  const tables = s.run({ type: "tables.generate", outlet_id: P, count: 3 }) as DemoState["tables"];
  assert.deepEqual(tables.map(t => t.name), ["Meja 9", "Meja 10", "Meja 11"]);
  const keys = s.getSnapshot().categories.filter(c => c.outlet_id === P).map(c => c.id).reverse();
  s.run({ type: "entity.reorder", entity: "categories", ids: keys }); assert.deepEqual(s.publicMenu(P).categories.map(c => c.id), keys);
  invalid(s, { type: "entity.reorder", entity: "categories", ids: [keys[0], keys[0]] });
  invalid(s, { type: "entity.reorder", entity: "categories", ids: [keys[0]] });
  s.run({ type: "company.save", value: { name: "Renamed", code: "new_demo", email: "new@rakku.invalid", owner_name: "New Owner", injected: "ignored" } });
  assert.equal(s.getSnapshot().company.code, "NEW_DEMO"); assert.ok(!("injected" in s.getSnapshot().company));
  invalid(s, { type: "company.password", current: "wrong", password: "NextPass123!" });
  s.run({ type: "company.password", current: "DemoCafe2026!", password: "NextPass123!" }); assert.equal(s.getSnapshot().company.password, "NextPass123!");
  invalid(s, { type: "company.save", value: { password: "unsafe" } });
});

test("invalid command, resource IDs, relation IDs and numbers cannot partially write", () => {
  const s = owner();
  for (const command of [null, { type: "unknown" }, { type: "order.quote", ...input(), tier_id: "missing" }, { type: "order.quote", ...input(), items: [] },
    { type: "order.quote", ...input(), items: [{ product_id: id("product", 0), quantity: Infinity }] },
    { type: "order.quote", ...input(), items: [{ product_id: id("product", 0), quantity: 1, modifier_ids: [id("modifier:4", 0)] }] },
    { type: "order.quote", ...input(), table_id: id("table", 1, T) },
    { type: "order.create", ...input(), status: "completed", payment_method: "qris" },
    { type: "order.create", ...input(), status: "pending", payment_method: "qris", amount_paid: 1 },
    { type: "order.create", ...input(), status: "draft", payment_method: "cash", splits: {} },
    { type: "order.create", ...input(), status: "completed", payment_method: { toString: () => "cash" } },
    { type: "order.complete", id: "missing", payment_method: "cash" }, { type: "payment.retry", id: "missing" },
    { type: "purchase.create", outlet_id: P, supplier_name: "x", note: "", items: [{ ingredient_id: id("ingredient", 0), quantity: -1, unit_cost: 0 }] },
    { type: "tables.generate", outlet_id: P, count: 0 }, { type: "entity.delete", entity: "products", id: "missing" },
    { type: "entity.save", entity: "products", value: { id: 0, name: "Invalid ID", category_id: id("category", 0), price: 1 } },
  ]) invalid(s, command);
});
