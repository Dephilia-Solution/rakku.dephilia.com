// Test-only isolated workflow, invoked by contracts.test.ts with the sentinel preload.
import assert from "node:assert/strict";
import { createDemoSandbox, DEMO_IDS, fixtureId } from "../index";
import type { DemoOrder, DemoState } from "./models";
import type { PaymentIntent, SubscriptionInvoice, Withdrawal } from "@rakku/shared-types";

// Demonstrate that the sentinels really fail before exercising the domain.
for (const provider of ["@rakku/db", "@rakku/auth-utils", "@rakku/echo-client", "@rakku/silos-client", "@rakku/vessel-client", "@neondatabase/auth"]) {
  await assert.rejects(import(provider), /Production provider sentinel/);
}
assert.throws(() => globalThis.localStorage, /Storage\/network sentinel/);
assert.throws(() => globalThis.fetch("https://provider.invalid"), /External provider sentinel/);

const a = createDemoSandbox(new Date("2026-10-12T05:00:00Z")), b = createDemoSandbox(new Date("2026-10-12T05:00:00Z"));
a.run({ type: "session.owner" }); const outlet_id = DEMO_IDS.pusat;
const id = (kind: string, key: number) => fixtureId(outlet_id, kind, key);
const args = { outlet_id, tier_id: id("tier", 0), items: [{ product_id: id("product", 4), quantity: 2 }] };
a.run({ type: "order.quote", ...args }); a.publicMenu(outlet_id); a.report(); a.salesReport();
const attached = a.attachImage(new File([new Uint8Array([1, 2, 3])], "demo.png", { type: "image/png" }));
a.run({ type: "entity.save", entity: "products", value: { id: id("product", 0), image_url: attached } });
a.removeImage(attached); // Still in use: retained until destroy.
const discarded = a.attachImage(new File([new Uint8Array([4, 5])], "demo.webp", { type: "image/webp" }));
a.removeImage(discarded);
const draft = a.run({ type: "order.create", ...args, status: "draft", payment_method: "cash" }) as DemoOrder;
a.run({ type: "order.complete", id: draft.id, payment_method: "cash" });
const order = a.run({ type: "order.create", ...args, status: "pending", payment_method: "qris" }) as DemoOrder;
const intent = a.run({ type: "payment.create", order_id: order.id }) as PaymentIntent;
a.run({ type: "payment.transition", id: intent.id, status: "success" });
a.run({ type: "stock.adjust", ingredient_id: id("ingredient", 0), quantity: 6000, note: "Opname" });
a.run({ type: "purchase.create", outlet_id, supplier_name: "Simulated", note: "", items: [{ ingredient_id: id("ingredient", 0), quantity: 100, unit_cost: 125 }] });
a.run({ type: "entity.save", entity: "expenses", value: { outlet_id, category: "Demo", amount: 5000 } });
a.run({ type: "tables.generate", outlet_id, count: 1 });
const pending = a.getSnapshot().withdrawals.find(w => w.status === "requested")!;
a.run({ type: "withdrawal.transition", id: pending.id, status: "rejected" });
const withdrawal = a.run({ type: "withdrawal.create", bank_id: "fixture:bank:0", amount: 50000 }) as Withdrawal;
a.run({ type: "withdrawal.transition", id: withdrawal.id, status: "completed" });
const invoice = a.run({ type: "subscription.checkout", plan: "pro", billing_cycle: "monthly" }) as SubscriptionInvoice;
a.run({ type: "subscription.transition", id: invoice.id, status: "success" });
const mail = a.run({ type: "email.preview", to: "owner@rakku.invalid" }) as DemoState["outbox"][number];
assert.equal(mail.status, "simulated");
assert.equal(mail.kind, "report");
assert.ok(a.getSnapshot().outbox.some(message => message.kind === "system"));
a.run({ type: "company.save", value: { name: "Isolated Demo" } });
a.run({ type: "company.password", current: "DemoCafe2026!", password: "Isolated2026!" });
a.run({ type: "session.cashier", outlet_id, employee_id: "fixture:bima_pusat", pin: "222222" });
a.report(); a.getSnapshot(); a.run({ type: "session.switchUser" }); a.run({ type: "tick" });
const unsubscribe = a.subscribe(() => {}); unsubscribe(); a.destroy(); b.destroy();
console.log("isolated-domain-ok");
