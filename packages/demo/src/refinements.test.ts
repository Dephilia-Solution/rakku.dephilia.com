import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoSandbox, DEMO_IDS, fixtureId, jakartaDate } from "../index";
import type { DemoCommand, DemoOrder, DemoProduct } from "./models";
import type { PaymentIntent, SubscriptionInvoice, Withdrawal } from "@rakku/shared-types";

const NOW = new Date("2026-10-12T05:00:00Z"), P = DEMO_IDS.pusat, T = DEMO_IDS.taman;
const id = (kind: string, key: number, outlet: string = P) => fixtureId(outlet, kind, key);
function owner() { const sandbox = createDemoSandbox(NOW); sandbox.run({ type: "session.owner" }); return sandbox; }
type Sandbox = ReturnType<typeof owner>;
function plan(sandbox: Sandbox, slug: "free" | "pro" | "business") {
  const invoice = sandbox.run({ type: "subscription.checkout", plan: slug, billing_cycle: "monthly" }) as SubscriptionInvoice;
  sandbox.run({ type: "subscription.transition", id: invoice.id, status: "success" }); return invoice;
}
function invalid(sandbox: Sandbox, command: DemoCommand, match: RegExp) {
  const snapshot = sandbox.getSnapshot(); assert.throws(() => sandbox.run(command), match); assert.equal(sandbox.getSnapshot(), snapshot);
}
function productImage(sandbox: Sandbox, productId: string, image_url: string | null) {
  return sandbox.run({ type: "entity.save", entity: "products", value: { id: productId, image_url } }) as DemoProduct;
}
function image(type = "image/png", size = 10) { return new File([new Uint8Array(size)], "demo-image", { type }); }
const orderInput = { outlet_id: P, tier_id: id("tier", 0), items: [{ product_id: id("product", 4), quantity: 2 }] };

test("Free sales reports retain sales totals and redact every cost/profit breakdown", () => {
  const sandbox = owner(), full = sandbox.report();
  assert.deepEqual(sandbox.salesReport(), full, "Business sales API retains the full permitted report");
  plan(sandbox, "free"); const snapshot = sandbox.getSnapshot(), sales = sandbox.salesReport();
  assert.equal(sales.revenue, full.revenue); assert.equal(sales.orders, 120);
  assert.equal(sales.subtotal, full.subtotal); assert.equal(sales.tax, full.tax); assert.equal(sales.discounts, full.discounts); assert.equal(sales.averageOrder, full.averageOrder);
  assert.deepEqual([sales.cogs, sales.expenses, sales.grossProfit, sales.netProfit], [0, 0, 0, 0]);
  assert.ok(sales.daily.every(day => day.cogs === 0 && day.expenses === 0)); assert.ok(sales.products.every(product => product.cogs === 0));
  assert.equal(sales.daily.reduce((sum, day) => sum + day.revenue, 0), full.revenue);
  assert.equal(sandbox.getSnapshot(), snapshot); assert.ok(Object.isFrozen(sales.products));
  assert.throws(() => sandbox.report(), /profit_loss/);
  const today = jakartaDate(snapshot.now); assert.equal(sandbox.salesReport(P, today, today).orders, 2);
  assert.throws(() => sandbox.salesReport(P, "2026-09-12", today), /report_history_days/);
  assert.throws(() => sandbox.salesReport(P, today, "2026-01-01"), /range/);
  assert.throws(() => sandbox.salesReport(P, "2026-02-30", today), /calendar date/);
  assert.throws(() => sandbox.salesReport("invalid"), /Resource not found/);
  sandbox.run({ type: "session.cashier", outlet_id: P, employee_id: "fixture:bima_pusat", pin: "222222" });
  assert.equal(sandbox.salesReport().orders, 60); assert.throws(() => sandbox.salesReport(T), /Outlet access/);
  sandbox.run({ type: "session.owner" });
  sandbox.run({ type: "entity.save", entity: "roles", value: { id: DEMO_IDS.cashier, name: "Orders-only" } });
  // Upgrade permits changing role menus; downgrade retains the edited permissions.
  plan(sandbox, "pro"); sandbox.run({ type: "entity.save", entity: "roles", value: { id: DEMO_IDS.cashier, menus: ["orders"] } }); plan(sandbox, "free");
  sandbox.run({ type: "session.cashier", outlet_id: P, employee_id: "fixture:bima_pusat", pin: "222222" });
  assert.throws(() => sandbox.salesReport(), /permission/);
  sandbox.run({ type: "session.switchUser" }); assert.throws(() => sandbox.salesReport(), /Authentication/);
  sandbox.destroy(); assert.throws(() => sandbox.salesReport(), /destroyed/);
});

test("Free keeps sales reports available but atomically rejects every email-preview form for owner and POS", () => {
  const sandbox = owner(); plan(sandbox, "free");
  invalid(sandbox, { type: "email.preview", to: "report@rakku.invalid" }, /PLAN_LIMIT: email_reports$/);
  invalid(sandbox, { type: "email.preview", email: "report@rakku.invalid", outlet_id: P, from: "2026-10-12", to: "2026-10-12" }, /PLAN_LIMIT: email_reports$/);
  assert.equal(sandbox.getSnapshot().outbox.filter(mail => mail.kind === "report").length, 0);
  assert.equal(sandbox.salesReport().cogs, 0);
  sandbox.run({ type: "session.cashier", outlet_id: P, employee_id: "fixture:bima_pusat", pin: "222222" });
  invalid(sandbox, { type: "email.preview", to: "report@rakku.invalid" }, /PLAN_LIMIT: email_reports$/);
  assert.equal(sandbox.salesReport().orders, 60);
});

test("draft dynamic QRIS completion is rejected atomically and manual QRIS still completes", () => {
  const sandbox = owner(), draft = sandbox.run({ type: "order.create", ...orderInput, status: "draft", payment_method: "cash" }) as DemoOrder;
  const before = sandbox.getSnapshot();
  invalid(sandbox, { type: "order.complete", id: draft.id, payment_method: "qris" }, /Draft.*dynamic QRIS/);
  invalid(sandbox, { type: "payment.create", order_id: draft.id }, /pending QRIS/);
  assert.equal(sandbox.getSnapshot().movements.length, before.movements.length); assert.deepEqual(sandbox.getSnapshot().balance, before.balance);
  const completed = sandbox.run({ type: "order.complete", id: draft.id, payment_method: "qris_manual" }) as DemoOrder;
  assert.equal(completed.status, "completed"); assert.equal(completed.payment_channel, "manual_qris");
});

test("attachImage validates File/MIME/2 MiB limits and requires product permission before creating URLs", t => {
  const sandbox = owner(), calls: File[] = [];
  t.mock.method(URL, "createObjectURL", (file: File) => { calls.push(file); return `blob:test:${calls.length}`; });
  const revoke = t.mock.method(URL, "revokeObjectURL", () => {});
  const snapshot = sandbox.getSnapshot();
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.match(sandbox.attachImage(image(type)), /^blob:test:/);
  assert.equal(sandbox.attachImage(image("image/png", 2 * 1024 * 1024)), "blob:test:4");
  for (const bad of [image("image/gif"), image("image/svg+xml"), image("text/plain"), image(""), image("image/png", 0), image("image/png", 2 * 1024 * 1024 + 1), {} as File, new Blob(["x"], { type: "image/png" }) as File]) {
    assert.throws(() => sandbox.attachImage(bad), /File|image|2 MiB/);
  }
  assert.equal(calls.length, 4); assert.equal(sandbox.getSnapshot(), snapshot, "attachments do not publish unrelated domain changes");
  sandbox.run({ type: "session.cashier", outlet_id: P, employee_id: "fixture:bima_pusat", pin: "222222" });
  assert.throws(() => sandbox.attachImage(image()), /permission/); assert.equal(calls.length, 4);
  sandbox.run({ type: "session.cashier", outlet_id: P, employee_id: "fixture:rani_pusat", pin: "111111" });
  assert.equal(sandbox.attachImage(image()), "blob:test:5");
  sandbox.destroy(); assert.equal(revoke.mock.callCount(), 5);
  assert.throws(() => sandbox.attachImage(image()), /destroyed/); assert.throws(() => sandbox.removeImage("blob:test:5"), /destroyed/);
});

test("product images are session-owned, reject foreign/stale URLs, and retain shared references until detached", t => {
  let count = 0;
  t.mock.method(URL, "createObjectURL", () => `blob:visitor:${++count}`);
  const revoked: string[] = []; t.mock.method(URL, "revokeObjectURL", (url: string) => { revoked.push(url); });
  const a = owner(), b = owner(), first = a.attachImage(image());
  let events = 0; a.subscribe(() => events++);
  productImage(a, id("product", 0), first); productImage(a, id("product", 1), first);
  assert.equal(a.publicMenu(P).categories[0].products[0].image_url, first);
  for (const url of [first, "blob:arbitrary", "data:image/png;base64,AA==", "http://images.invalid/a.png", "https://images.invalid/a.png"]) invalid(b, { type: "entity.save", entity: "products", value: { id: id("product", 0), image_url: url } }, /Image/);
  const replacement = a.attachImage(image("image/webp")); productImage(a, id("product", 0), replacement);
  assert.deepEqual(revoked, [], "save must not implicitly revoke a shared URL");
  a.removeImage(first); assert.deepEqual(revoked, [], "the second product still uses the old URL");
  productImage(a, id("product", 1), "/demo-assets/cafe.svg"); const snapshot = a.getSnapshot(), eventCount = events;
  a.removeImage(first); assert.deepEqual(revoked, [first]); assert.equal(a.getSnapshot(), snapshot); assert.equal(events, eventCount);
  invalid(a, { type: "entity.save", entity: "products", value: { id: id("product", 1), image_url: first } }, /Image/);
  a.removeImage(first); b.removeImage(replacement); a.removeImage("/demo-assets/cafe.svg"); assert.deepEqual(revoked, [first], "unknown/foreign/released URLs are never revoked");
  const pending = a.attachImage(image()); a.destroy(); a.destroy(); assert.deepEqual(revoked, [first, replacement, pending]);
  invalid(b, { type: "entity.save", entity: "products", value: { id: id("product", 0), image_url: replacement } }, /Image/);
  assert.throws(() => a.removeImage(replacement), /destroyed/); b.destroy(); assert.deepEqual(revoked, [first, replacement, pending]);
});

test("failed image saves and product deletion release only explicitly discarded unused URLs", t => {
  let count = 0; t.mock.method(URL, "createObjectURL", () => `blob:delete:${++count}`);
  const revoked: string[] = []; t.mock.method(URL, "revokeObjectURL", (url: string) => { revoked.push(url); });
  const sandbox = owner(), failed = sandbox.attachImage(image());
  invalid(sandbox, { type: "entity.save", entity: "products", value: { name: "Invalid", category_id: "invalid", image_url: failed } }, /Resource not found/);
  sandbox.removeImage(failed); assert.deepEqual(revoked, [failed]);
  const shared = sandbox.attachImage(image());
  const product = sandbox.run({ type: "entity.save", entity: "products", value: { outlet_id: P, name: "Uploaded", category_id: id("category", 0), image_url: shared, price: 10000 } }) as DemoProduct;
  productImage(sandbox, id("product", 0), shared);
  sandbox.run({ type: "entity.delete", entity: "products", id: product.id }); sandbox.removeImage(shared);
  assert.deepEqual(revoked, [failed]); productImage(sandbox, id("product", 0), null); sandbox.removeImage(shared); assert.deepEqual(revoked, [failed, shared]);
  sandbox.destroy(); assert.deepEqual(revoked, [failed, shared]);
});

test("system outbox notifications are correlated, idempotent, private to owner and outside report quota", () => {
  const sandbox = owner(), seedPending = sandbox.getSnapshot().withdrawals.find(withdrawal => withdrawal.status === "requested")!;
  sandbox.run({ type: "withdrawal.transition", id: seedPending.id, status: "rejected", note: "Demo rejected" });
  const withdrawal = sandbox.run({ type: "withdrawal.create", bank_id: "fixture:bank:0", amount: 50000 }) as Withdrawal;
  sandbox.run({ type: "withdrawal.transition", id: withdrawal.id, status: "processing", note: "Demo processing" });
  const processing = sandbox.getSnapshot(); sandbox.run({ type: "withdrawal.transition", id: withdrawal.id, status: "processing" }); assert.equal(sandbox.getSnapshot(), processing);
  sandbox.run({ type: "withdrawal.transition", id: withdrawal.id, status: "completed" });
  const done = sandbox.getSnapshot(); sandbox.run({ type: "withdrawal.transition", id: withdrawal.id, status: "completed" }); assert.equal(sandbox.getSnapshot(), done);
  const invoice = plan(sandbox, "pro");
  const notifications = sandbox.getSnapshot().outbox.filter(mail => mail.kind === "system");
  assert.deepEqual(notifications.map(mail => [mail.notification_type, mail.reference_id]), [
    ["withdrawal_rejected", seedPending.id], ["withdrawal_requested", withdrawal.id], ["withdrawal_processing", withdrawal.id], ["withdrawal_completed", withdrawal.id], ["subscription_success", invoice.id],
  ]);
  for (const mail of notifications) { assert.equal(mail.to, "owner@rakku.invalid"); assert.equal(mail.status, "simulated"); assert.equal(mail.report, null); assert.match(mail.body, /SIMULASI.*tidak dikirim/); assert.ok(Object.isFrozen(mail)); }
  assert.match(notifications.find(mail => mail.notification_type === "withdrawal_rejected")!.body, /Demo rejected/);
  assert.match(notifications.find(mail => mail.notification_type === "withdrawal_completed")!.body, /DEMO-TRANSFER/);
  assert.match(notifications.find(mail => mail.notification_type === "subscription_success")!.body, /Pro/);
  const activated = sandbox.getSnapshot(); sandbox.run({ type: "subscription.transition", id: invoice.id, status: "success" }); assert.equal(sandbox.getSnapshot(), activated);
  for (let i = 0; i < 100; i++) sandbox.run({ type: "email.preview", email: "report@rakku.invalid" });
  invalid(sandbox, { type: "email.preview", to: "report@rakku.invalid" }, /email_reports_month/);
  const next = sandbox.run({ type: "withdrawal.create", bank_id: "fixture:bank:0", amount: 50000 }) as Withdrawal;
  sandbox.run({ type: "withdrawal.transition", id: next.id, status: "rejected", note: "Quota-independent notification" });
  assert.equal(sandbox.getSnapshot().outbox.filter(mail => mail.kind === "report").length, 100);
  assert.equal(sandbox.getSnapshot().outbox.filter(mail => mail.kind === "system").length, 7);
  const before = sandbox.getSnapshot(); invalid(sandbox, { type: "withdrawal.create", bank_id: "invalid", amount: 50000 }, /Resource not found/); assert.equal(sandbox.getSnapshot().outbox.length, before.outbox.length);
  sandbox.run({ type: "session.cashier", outlet_id: P, employee_id: "fixture:bima_pusat", pin: "222222" }); assert.equal(sandbox.getSnapshot().outbox.length, 0);
});

test("manual, draft and dynamic QRIS completion keep production table occupancy until manual release", () => {
  const sandbox = owner();
  sandbox.run({ type: "order.create", ...orderInput, table_id: id("table", 4), status: "completed", payment_method: "cash" });
  const draft = sandbox.run({ type: "order.create", ...orderInput, table_id: id("table", 5), status: "draft", payment_method: "cash" }) as DemoOrder;
  sandbox.run({ type: "order.complete", id: draft.id, payment_method: "card" });
  const pending = sandbox.run({ type: "order.create", ...orderInput, table_id: id("table", 6), status: "pending", payment_method: "qris" }) as DemoOrder;
  const payment = sandbox.run({ type: "payment.create", order_id: pending.id }) as PaymentIntent;
  sandbox.run({ type: "payment.transition", id: payment.id, status: "success" });
  sandbox.run({ type: "tick", now: "2026-10-13T05:00:00Z" });
  for (const table of [4, 5, 6]) assert.equal(sandbox.getSnapshot().tables.find(row => row.id === id("table", table))!.status, "occupied");
  sandbox.run({ type: "entity.save", entity: "tables", value: { id: id("table", 6), status: "available" } });
  assert.equal(sandbox.getSnapshot().tables.find(row => row.id === id("table", 6))!.status, "available");
});

test("quotes apply only the first active date-valid order discount, with product discounts still applied first", () => {
  const sandbox = owner(), today = jakartaDate(sandbox.getSnapshot().now);
  sandbox.run({ type: "entity.save", entity: "discounts", value: { id: id("discount", 1), is_active: true } });
  const second = sandbox.run({ type: "entity.save", entity: "discounts", value: { outlet_id: P, name: "Second order promo", type: "fixed", value: 10000, start_date: today, end_date: today, is_active: true } }) as { id: string };
  const quote = sandbox.run({ type: "order.quote", ...orderInput }) as DemoOrder;
  assert.equal(quote.subtotal, 52000); assert.equal(quote.discount_amount, 5000); assert.equal(quote.tax_amount, 4700); assert.equal(quote.total, 51700); assert.equal(quote.discounts!.length, 1);
  sandbox.run({ type: "entity.save", entity: "discounts", value: { id: id("discount", 1), is_active: false } });
  const next = sandbox.run({ type: "order.quote", ...orderInput }) as DemoOrder;
  assert.equal(next.discount_amount, 10000); assert.equal(next.total, 46200); assert.equal(next.discounts![0].name, "Second order promo");
  const matcha = sandbox.run({ type: "order.quote", ...orderInput, items: [{ product_id: id("product", 5), quantity: 2 }] }) as DemoOrder;
  assert.equal(matcha.subtotal, 57600); assert.equal(matcha.discount_amount, 16400); assert.equal(matcha.tax_amount, 4760); assert.equal(matcha.total, 52360);
  sandbox.run({ type: "entity.save", entity: "discounts", value: { id: second.id, end_date: "2026-10-11", start_date: "2026-10-10" } });
  const expired = sandbox.run({ type: "order.quote", ...orderInput }) as DemoOrder;
  assert.equal(expired.discount_amount, 0); assert.equal(expired.total, 57200);
});

test("negative stock caused by sales stays metadata-editable while direct/new negative stock writes remain invalid", () => {
  const sandbox = owner();
  sandbox.run({ type: "order.create", ...orderInput, items: [{ product_id: id("product", 4), quantity: 1000 }], status: "completed", payment_method: "cash" });
  const before = sandbox.getSnapshot(), ingredient = before.ingredients.find(row => row.id === id("ingredient", 0))!;
  assert.equal(ingredient.stock_quantity, -12000);
  sandbox.run({ type: "entity.save", entity: "ingredients", value: { id: ingredient.id, name: "Biji kopi — counted", cost_per_unit: 130, min_stock_alert: 600 } });
  const changed = sandbox.getSnapshot().ingredients.find(row => row.id === ingredient.id)!;
  assert.equal(changed.stock_quantity, -12000); assert.equal(changed.cost_per_unit, 130); assert.equal(changed.min_stock_alert, 600); assert.match(changed.name, /counted/);
  assert.deepEqual(sandbox.getSnapshot().movements, before.movements);
  invalid(sandbox, { type: "entity.save", entity: "ingredients", value: { id: ingredient.id, stock_quantity: -1 } }, /stock.adjust/);
  invalid(sandbox, { type: "entity.save", entity: "ingredients", value: { name: "Invalid negative opening", outlet_id: P, unit: "gram", stock_quantity: -1 } }, /stock/);
  invalid(sandbox, { type: "stock.adjust", ingredient_id: ingredient.id, quantity: -1, note: "Invalid absolute count" }, /stock/);
  sandbox.run({ type: "stock.adjust", ingredient_id: ingredient.id, quantity: 0, note: "Absolute recount" });
  const state = sandbox.getSnapshot(); assert.equal(state.ingredients.find(row => row.id === ingredient.id)!.stock_quantity, 0);
  assert.equal(state.movements.filter(row => row.ingredient_id === ingredient.id).reduce((sum, row) => sum + row.quantity_change, 0), 0);
});
