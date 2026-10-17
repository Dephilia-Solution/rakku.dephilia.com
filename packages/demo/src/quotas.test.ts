import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoSandbox, DEMO_IDS, fixtureId, jakartaDate } from "../index";
import type { DemoOrder, DemoProduct } from "./models";
import type { PaymentIntent, SubscriptionInvoice, Withdrawal } from "@rakku/shared-types";
const NOW = new Date("2026-10-12T05:00:00Z"), outlet_id = DEMO_IDS.pusat;
const id = (kind: string, key: number) => fixtureId(outlet_id, kind, key);
function sandbox() { const s = createDemoSandbox(NOW); s.run({ type: "session.owner" }); return s; }
function freeQuotaSandbox() {
  const s = sandbox();
  const product = s.run({ type: "entity.save", entity: "products", value: { name: "Quota test coffee", outlet_id, category_id: id("category", 0), price: 1000, recipe: [] } }) as DemoProduct;
  const invoice = s.run({ type: "subscription.checkout", plan: "free", billing_cycle: "monthly" }) as SubscriptionInvoice;
  s.run({ type: "subscription.transition", id: invoice.id, status: "success" });
  const command = { type: "order.create" as const, outlet_id, tier_id: id("tier", 0), items: [{ product_id: product.id, quantity: 1 }], status: "completed" as const, payment_method: "cash" as const };
  const count = () => s.getSnapshot().orders.filter(o => o.status === "completed" && jakartaDate(o.created_at).slice(0, 7) === jakartaDate(s.getSnapshot().now).slice(0, 7)).length;
  while (count() < 500) s.run(command);
  return { s, command, count };
}

test("monthly transaction quotas allow exactly 10% grace and reset on Jakarta month boundary", () => {
  const { s, command, count } = freeQuotaSandbox();
  assert.equal(count(), 500);
  for (let i = 0; i < 50; i++) s.run(command);
  assert.equal(count(), 550); const before = s.getSnapshot(); assert.throws(() => s.run(command), /PLAN_LIMIT: transactions/); assert.equal(s.getSnapshot(), before);
  // Drafts remain possible after the completed-transaction quota is exhausted.
  assert.doesNotThrow(() => s.run({ ...command, status: "draft" }));
  s.run({ type: "tick", now: "2026-10-31T17:00:00Z" }); assert.equal(count(), 0); s.run(command); assert.equal(count(), 1);
});

test("transaction grace ends after three days even while amount grace remains", () => {
  const { s, command, count } = freeQuotaSandbox();
  assert.equal(count(), 500);
  s.run({ type: "tick", now: "2026-10-15T05:00:00Z" }); s.run(command); assert.equal(count(), 501);
  s.run({ type: "tick", now: "2026-10-15T05:00:00.001Z" });
  const before = s.getSnapshot(); assert.throws(() => s.run(command), /PLAN_LIMIT: transactions/); assert.equal(s.getSnapshot(), before);
});

test("withdrawal daily aggregate includes completed holds, excludes rejected, resets in Jakarta", () => {
  const s = sandbox();
  const seedPending = s.getSnapshot().withdrawals.find(w => w.status === "requested")!;
  s.run({ type: "withdrawal.transition", id: seedPending.id, status: "rejected" });
  // Fund through actual simulated QRIS success, never by writing balances directly.
  const product = s.run({ type: "entity.save", entity: "products", value: { name: "Large simulated catering", outlet_id, category_id: id("category", 2), price: 15000000, recipe: [] } }) as DemoProduct;
  const order = s.run({ type: "order.create", outlet_id, tier_id: id("tier", 0), items: [{ product_id: product.id, quantity: 1 }], status: "pending", payment_method: "qris" }) as DemoOrder;
  const payment = s.run({ type: "payment.create", order_id: order.id }) as PaymentIntent;
  s.run({ type: "payment.transition", id: payment.id, status: "success" });
  const withdraw = (amount: number) => s.run({ type: "withdrawal.create", bank_id: "fixture:bank:0", amount }) as Withdrawal;
  const rejected = withdraw(5000000); s.run({ type: "withdrawal.transition", id: rejected.id, status: "rejected" });
  const first = withdraw(6000000); s.run({ type: "withdrawal.transition", id: first.id, status: "completed" });
  const second = withdraw(4000000); s.run({ type: "withdrawal.transition", id: second.id, status: "completed" });
  const before = s.getSnapshot(); assert.throws(() => withdraw(50000), /Daily withdrawal limit/); assert.equal(s.getSnapshot(), before);
  s.run({ type: "tick", now: "2026-10-12T17:00:00Z" }); assert.doesNotThrow(() => withdraw(50000));
  assert.ok(s.getSnapshot().balance!.available_balance >= 0); assert.equal(s.getSnapshot().balance!.pending_balance, 50000);
});

test("resource quotas count company totals; edit/deactivate preserve data; upgrade unlocks new capacity", () => {
  const s = sandbox();
  const invoice = s.run({ type: "subscription.checkout", plan: "free", billing_cycle: "monthly" }) as SubscriptionInvoice;
  s.run({ type: "subscription.transition", id: invoice.id, status: "success" });
  for (let i = 0; i < 10; i++) s.run({ type: "entity.save", entity: "products", value: { name: `Extra ${i}`, outlet_id, category_id: id("category", 0), price: 1000 } });
  assert.equal(s.getSnapshot().products.length, 30);
  const before = s.getSnapshot(); assert.throws(() => s.run({ type: "entity.save", entity: "products", value: { name: "Over quota", outlet_id, category_id: id("category", 0), price: 1000 } }), /PLAN_LIMIT/); assert.equal(s.getSnapshot(), before);
  assert.throws(() => s.run({ type: "stock.adjust", ingredient_id: id("ingredient", 0), quantity: 100, note: "Plan gated" }), /inventory_advanced/);
  assert.throws(() => s.run({ type: "purchase.create", outlet_id, supplier_name: "x", note: "", items: [] }), /inventory_advanced/);
  assert.throws(() => s.run({ type: "entity.save", entity: "roles", value: { id: DEMO_IDS.manager, menus: ["orders"] } }), /custom_roles/);
  s.run({ type: "entity.save", entity: "products", value: { id: id("product", 0), is_active: false } }); assert.equal(s.getSnapshot().products.length, 30);
  const upgrade = s.run({ type: "subscription.checkout", plan: "pro", billing_cycle: "monthly" }) as SubscriptionInvoice;
  s.run({ type: "subscription.transition", id: upgrade.id, status: "success" });
  s.run({ type: "entity.save", entity: "outlets", value: { name: "Third outlet" } }); assert.equal(s.getSnapshot().outlets.length, 3);
  assert.throws(() => s.run({ type: "entity.save", entity: "outlets", value: { name: "Fourth outlet" } }), /PLAN_LIMIT/);
  assert.throws(() => s.report(undefined, "2020-01-01", "2026-10-12"), /report_history_days/);
  const existingCount = s.getSnapshot().ingredients.length;
  s.run({ type: "stock.adjust", ingredient_id: id("ingredient", 0), quantity: 100, note: "Upgraded" }); assert.equal(s.getSnapshot().ingredients.length, existingCount);
});
