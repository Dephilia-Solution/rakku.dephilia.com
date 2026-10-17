import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createDemoSandbox, DEMO_IDS, fixtureId } from "../index";
import type { DemoCommand, DemoState } from "./models";
import type { BillingCycle, PlanSlug, SubscriptionInvoice } from "@rakku/shared-types";
import { fixturePlans } from "./fixture";
import { GRACE_DAYS } from "./constants";

const NOW = "2026-10-12T05:00:00.000Z", P = DEMO_IDS.pusat;
const id = (kind: string, key: number) => fixtureId(P, kind, key);
function owner(now = NOW) { const sandbox = createDemoSandbox(new Date(now)); sandbox.run({ type: "session.owner" }); return sandbox; }
type Sandbox = ReturnType<typeof owner>;
function checkout(sandbox: Sandbox, plan: PlanSlug = "business", billing_cycle: BillingCycle = "monthly") {
  return sandbox.run({ type: "subscription.checkout", plan, billing_cycle }) as SubscriptionInvoice;
}
function activate(sandbox: Sandbox, plan: PlanSlug = "business", cycle: BillingCycle = "monthly") {
  const invoice = checkout(sandbox, plan, cycle);
  sandbox.run({ type: "subscription.transition", id: invoice.id, status: "success" }); return invoice;
}
function lifecycle(state: DemoState) {
  return { subscription: state.subscription, subscription_status: state.subscription_status, billing_cycle: state.billing_cycle, plan_expires_at: state.plan_expires_at, plan: state.plan };
}
function data(state: DemoState) {
  return { company: state.company, outlets: state.outlets, employees: state.employees, roles: state.roles, categories: state.categories, tiers: state.tiers, products: state.products,
    ingredients: state.ingredients, movements: state.movements, orders: state.orders, purchases: state.purchases, expenses: state.expenses, ledger: state.ledger, withdrawals: state.withdrawals, banks: state.banks };
}
function invalid(sandbox: Sandbox, command: DemoCommand, match: RegExp) {
  const before = sandbox.getSnapshot(); assert.throws(() => sandbox.run(command), match); assert.equal(sandbox.getSnapshot(), before);
}

test("Business fixture is an explicit frozen shared Subscription with one Jakarta calendar month", () => {
  const sandbox = owner(), state = sandbox.getSnapshot();
  assert.deepEqual(state.subscription, { id: "fixture:subscription:business", company_id: state.company.id, plan_id: "fixture:plan:business", status: "active", started_at: NOW,
    current_period_start: NOW, current_period_end: "2026-11-12T05:00:00.000Z", cancelled_at: null, created_at: NOW });
  assert.equal(state.subscription_status, "active"); assert.equal(state.billing_cycle, "monthly"); assert.equal(state.plan_expires_at, state.subscription.current_period_end); assert.equal(state.plan, "business");
  assert.ok(Object.isFrozen(state.subscription)); assert.throws(() => { state.subscription.plan_id = "fixture:plan:free"; });
  assert.equal(sandbox.getSnapshot(), state);
  assert.deepEqual(state.outlets.map(outlet => [outlet.name, outlet.address]), [["Rakku Demo Cafe — Pusat", "Jl. Contoh Raya No. 10"], ["Rakku Demo Cafe — Taman", "Jl. Contoh Taman No. 25"]]);
  assert.deepEqual(state.products.filter(product => product.outlet_id === P).map(product => product.name), ["Espresso", "Americano", "Cappuccino", "Caffe Latte", "Kopi Susu Gula Aren", "Matcha Latte", "Chocolate Latte", "Lemon Tea", "Butter Croissant", "French Fries"]);
  assert.deepEqual(state.taxes.filter(tax => tax.outlet_id === P).map(tax => tax.name), ["Pajak Demo", "Service Demo"]);
});

test("same-plan renewal extends future expiry; changing plan starts now; every activation replaces the current record", () => {
  const sandbox = owner(), seeded = sandbox.getSnapshot().subscription;
  const invoice = activate(sandbox), renewed = sandbox.getSnapshot();
  assert.equal(renewed.subscription.current_period_start, seeded.current_period_end); assert.equal(renewed.plan_expires_at, "2026-12-12T05:00:00.000Z");
  assert.equal(renewed.subscription.started_at, NOW); assert.equal(renewed.subscription.created_at, NOW);
  assert.ok(renewed.subscription.id.startsWith(`${sandbox.generation}:subscription:`)); assert.notEqual(renewed.subscription.id, seeded.id);
  assert.equal(renewed.subscription.plan_id, invoice.plan_id); assert.equal(renewed.subscription.company_id, renewed.company.id); assert.equal(renewed.subscription.cancelled_at, null);
  activate(sandbox, "business", "yearly"); const yearly = sandbox.getSnapshot();
  assert.equal(yearly.subscription.current_period_start, renewed.plan_expires_at); assert.equal(yearly.plan_expires_at, "2027-12-12T05:00:00.000Z"); assert.equal(yearly.billing_cycle, "yearly");
  activate(sandbox, "pro", "monthly"); const changed = sandbox.getSnapshot();
  assert.equal(changed.subscription.current_period_start, NOW); assert.equal(changed.plan_expires_at, "2026-11-12T05:00:00.000Z"); assert.equal(changed.billing_cycle, "monthly");
  assert.equal(changed.subscription.plan_id, "fixture:plan:pro"); assert.equal(changed.subscription.status, "active"); assert.equal(changed.subscription_status, "active"); assert.equal(changed.plan, "pro");
});

test("activation uses payment time rather than checkout time and publishes invoice/period/notification together", () => {
  const sandbox = owner(), invoice = checkout(sandbox, "pro", "yearly");
  sandbox.run({ type: "tick", now: "2026-10-12T05:03:00Z" });
  const observed: DemoState[] = []; sandbox.subscribe(() => observed.push(sandbox.getSnapshot()));
  sandbox.run({ type: "subscription.transition", id: invoice.id, status: "success" });
  assert.equal(observed.length, 1); const state = observed[0];
  assert.equal(state.subscription.started_at, state.now); assert.equal(state.subscription.current_period_start, state.now); assert.equal(state.subscription.created_at, state.now);
  assert.equal(state.plan_expires_at, "2027-10-12T05:03:00.000Z"); assert.equal(state.subscription.current_period_end, state.plan_expires_at);
  assert.equal(state.invoices.find(row => row.id === invoice.id)!.paid_at, state.now); assert.equal(state.invoices.find(row => row.id === invoice.id)!.status, "success");
  const mail = state.outbox.find(row => row.kind === "system" && row.reference_id === invoice.id)!;
  assert.match(mail.body, /2027-10-12/); assert.match(mail.body, /WIB/); assert.equal(state.plan, "pro");
});

test("repeated or older successful invoice callbacks cannot extend or switch the current subscription again", () => {
  const sandbox = owner(), invoice = activate(sandbox), once = sandbox.getSnapshot();
  sandbox.run({ type: "subscription.transition", id: invoice.id, status: "success" }); assert.equal(sandbox.getSnapshot(), once);
  activate(sandbox, "pro"); const newer = sandbox.getSnapshot();
  sandbox.run({ type: "subscription.transition", id: invoice.id, status: "success" }); assert.equal(sandbox.getSnapshot(), newer);
  sandbox.run({ type: "subscription.transition", id: "fixture:invoice:business", status: "success" }); assert.equal(sandbox.getSnapshot(), newer);
  invalid(sandbox, { type: "subscription.transition", id: invoice.id, status: "failed" }, /already final/);
  assert.equal(sandbox.getSnapshot().outbox.filter(row => row.kind === "system" && row.reference_id === invoice.id).length, 1);
});

test("invoice failed/expired/cancelled/retry paths preserve subscription periods until a fresh success", () => {
  for (const status of ["failed", "expired", "cancelled"] as const) {
    const sandbox = owner(), before = lifecycle(sandbox.getSnapshot()), invoice = checkout(sandbox, "pro", "yearly");
    assert.deepEqual(lifecycle(sandbox.getSnapshot()), before);
    sandbox.run({ type: "subscription.transition", id: invoice.id, status }); assert.deepEqual(lifecycle(sandbox.getSnapshot()), before);
    invalid(sandbox, { type: "subscription.transition", id: invoice.id, status: "success" }, /already final/);
    const retry = sandbox.run({ type: "subscription.retry", id: invoice.id }) as SubscriptionInvoice; assert.notEqual(retry.id, invoice.id); assert.deepEqual(lifecycle(sandbox.getSnapshot()), before);
    sandbox.run({ type: "tick", now: retry.expired_at! }); assert.deepEqual(lifecycle(sandbox.getSnapshot()), before);
    invalid(sandbox, { type: "subscription.transition", id: retry.id, status: "success" }, /already final/);
    const latest = sandbox.run({ type: "subscription.retry", id: retry.id }) as SubscriptionInvoice;
    invalid(sandbox, { type: "subscription.retry", id: invoice.id }, /Stale/);
    sandbox.run({ type: "subscription.transition", id: latest.id, status: "success" });
    assert.equal(sandbox.getSnapshot().subscription.current_period_start, sandbox.getSnapshot().now); assert.equal(sandbox.getSnapshot().billing_cycle, "yearly");
  }
});

test("calendar periods preserve Jakarta wall time with JS month overflow, leap days and year boundaries", () => {
  const cases: [string, BillingCycle, string][] = [
    ["2026-01-31T10:15:45.123+07:00", "monthly", "2026-03-03T10:15:45.123+07:00"],
    ["2028-01-31T10:15:45+07:00", "monthly", "2028-03-02T10:15:45+07:00"],
    ["2028-02-29T10:15:45+07:00", "yearly", "2029-03-01T10:15:45+07:00"],
    ["2026-12-31T23:59:59+07:00", "monthly", "2027-01-31T23:59:59+07:00"],
    ["2026-11-30T00:00:00+07:00", "monthly", "2026-12-30T00:00:00+07:00"],
    ["2026-01-30T18:15:00Z", "monthly", "2026-03-02T18:15:00Z"],
    ["2026-01-31T18:15:00Z", "monthly", "2026-02-28T18:15:00Z"],
    ["2028-02-28T18:15:00Z", "yearly", "2029-02-28T18:15:00Z"],
    ["2028-02-29T18:15:00Z", "yearly", "2029-02-28T18:15:00Z"],
  ];
  for (const [opened, cycle, end] of cases) {
    const sandbox = owner(opened); activate(sandbox, "pro", cycle);
    assert.equal(sandbox.getSnapshot().subscription.current_period_start, new Date(opened).toISOString(), opened);
    assert.equal(sandbox.getSnapshot().plan_expires_at, new Date(end).toISOString(), opened);
  }
  const monthEnd = owner("2026-01-31T10:15:00+07:00"); assert.equal(monthEnd.getSnapshot().plan_expires_at, "2026-03-03T03:15:00.000Z");
  activate(monthEnd); assert.equal(monthEnd.getSnapshot().subscription.current_period_start, "2026-03-03T03:15:00.000Z"); assert.equal(monthEnd.getSnapshot().plan_expires_at, "2026-04-03T03:15:00.000Z");
});

test("tick keeps paid features through grace then downgrades at its exact end while retaining renewal metadata/data", () => {
  const sandbox = owner(), expiry = sandbox.getSnapshot().plan_expires_at!, end = new Date(Date.parse(expiry) + 7 * 86400_000).toISOString();
  sandbox.run({ type: "tick", now: new Date(Date.parse(expiry) - 1).toISOString() }); assert.equal(sandbox.getSnapshot().subscription_status, "active");
  sandbox.run({ type: "tick", now: expiry }); const grace = sandbox.getSnapshot();
  assert.equal(grace.plan, "business"); assert.equal(grace.subscription_status, "grace"); assert.equal(grace.subscription.status, "grace");
  assert.equal(grace.plan_expires_at, expiry); assert.doesNotThrow(() => sandbox.report());
  sandbox.run({ type: "stock.adjust", ingredient_id: id("ingredient", 0), quantity: 1000, note: "Allowed during grace" });
  sandbox.run({ type: "tick", now: new Date(Date.parse(end) - 1).toISOString() }); assert.equal(sandbox.getSnapshot().subscription_status, "grace");
  const before = sandbox.getSnapshot(); sandbox.run({ type: "tick", now: end }); const expired = sandbox.getSnapshot();
  assert.equal(expired.plan, "free"); assert.equal(expired.subscription_status, "expired"); assert.equal(expired.subscription.status, "expired");
  assert.equal(expired.subscription.plan_id, "fixture:plan:business"); assert.equal(expired.subscription.current_period_start, NOW); assert.equal(expired.plan_expires_at, expiry);
  assert.equal(expired.subscription.id, before.subscription.id); assert.equal(expired.billing_cycle, "monthly"); assert.deepEqual(data(expired), data(before));
  assert.throws(() => sandbox.report(), /profit_loss/); assert.equal(sandbox.salesReport().cogs, 0);
  invalid(sandbox, { type: "entity.save", entity: "outlets", value: { name: "Over Free quota" } }, /PLAN_LIMIT/);
  invalid(sandbox, { type: "stock.adjust", ingredient_id: id("ingredient", 0), quantity: 0, note: "Locked after grace" }, /inventory_advanced/);
  sandbox.run({ type: "entity.save", entity: "products", value: { id: id("product", 0), description: "Still editable after expiry" } });
  const stable = sandbox.getSnapshot(); sandbox.run({ type: "tick", now: end }); assert.equal(sandbox.getSnapshot(), stable);
});

test("same-plan renewal during grace starts now instead of extending an already elapsed period", () => {
  const sandbox = owner(); sandbox.run({ type: "tick", now: "2026-11-14T05:00:00Z" }); assert.equal(sandbox.getSnapshot().subscription_status, "grace");
  activate(sandbox); const active = sandbox.getSnapshot();
  assert.equal(active.subscription.current_period_start, "2026-11-14T05:00:00.000Z"); assert.equal(active.plan_expires_at, "2026-12-14T05:00:00.000Z");
  assert.equal(active.subscription_status, "active"); assert.equal(active.subscription.status, "active"); assert.equal(active.plan, "business");
});

test("skipping grace downgrades directly; fresh success reactivates an expired raw plan from now", () => {
  const sandbox = owner(); sandbox.run({ type: "tick", now: "2027-01-01T00:00:00Z" }); const expired = sandbox.getSnapshot();
  assert.equal(expired.plan, "free"); assert.equal(expired.subscription_status, "expired"); assert.equal(expired.subscription.plan_id, "fixture:plan:business");
  const invoice = checkout(sandbox); assert.deepEqual(lifecycle(sandbox.getSnapshot()), lifecycle(expired));
  sandbox.run({ type: "subscription.transition", id: invoice.id, status: "failed" }); assert.deepEqual(lifecycle(sandbox.getSnapshot()), lifecycle(expired));
  const retry = sandbox.run({ type: "subscription.retry", id: invoice.id }) as SubscriptionInvoice;
  sandbox.run({ type: "subscription.transition", id: retry.id, status: "success" }); const renewed = sandbox.getSnapshot();
  assert.equal(renewed.plan, "business"); assert.equal(renewed.subscription_status, "active"); assert.equal(renewed.subscription.current_period_start, renewed.now);
  assert.equal(renewed.plan_expires_at, "2027-02-01T00:00:00.000Z"); assert.deepEqual(data(renewed), data(expired)); assert.doesNotThrow(() => sandbox.report());
});

test("Free activation also has a real period and expires to effective Free; later paid checkout restores features", () => {
  const sandbox = owner(); activate(sandbox, "free"); const free = sandbox.getSnapshot();
  assert.equal(free.plan, "free"); assert.equal(free.subscription.plan_id, "fixture:plan:free"); assert.equal(free.subscription_status, "active"); assert.equal(free.plan_expires_at, "2026-11-12T05:00:00.000Z");
  sandbox.run({ type: "tick", now: free.plan_expires_at! }); assert.equal(sandbox.getSnapshot().subscription_status, "grace"); assert.equal(sandbox.getSnapshot().plan, "free");
  sandbox.run({ type: "tick", now: "2026-11-19T05:00:00Z" }); assert.equal(sandbox.getSnapshot().subscription_status, "expired"); assert.equal(sandbox.getSnapshot().plan, "free");
  activate(sandbox, "pro", "yearly"); assert.equal(sandbox.getSnapshot().subscription.current_period_start, "2026-11-19T05:00:00.000Z"); assert.equal(sandbox.getSnapshot().plan_expires_at, "2027-11-19T05:00:00.000Z");
  assert.equal(sandbox.getSnapshot().plan, "pro"); assert.doesNotThrow(() => sandbox.report());
});

test("stale generations, foreign IDs and destroyed callbacks cannot alter a replacement subscription", () => {
  const a = owner(), b = owner(), pending = checkout(a), before = b.getSnapshot();
  const command = { type: "subscription.transition", id: pending.id, status: "success" } as const;
  assert.throws(() => b.run(command, a.generation), /Stale/); assert.equal(b.getSnapshot(), before);
  invalid(b, command, /Resource not found/); assert.equal(b.getSnapshot(), before);
  const oldCallback = () => a.run(command, a.generation); a.destroy(); assert.throws(oldCallback, /destroyed/); assert.equal(b.getSnapshot(), before);
  assert.throws(() => b.run({ type: "tick", now: "2027-01-01T00:00:00Z" }, a.generation), /Stale/); assert.equal(b.getSnapshot(), before);
  b.run({ type: "session.cashier", outlet_id: P, employee_id: "fixture:bima_pusat", pin: "222222" });
  invalid(b, { type: "subscription.checkout", plan: "pro", billing_cycle: "monthly" }, /Owner/);
});

test("active seed plus baseline defaults match the demo catalog; grace/calendar source parity is read-only", () => {
  const root = new URL("../../../", import.meta.url);
  const source = (path: string) => readFileSync(new URL(path, root), "utf8");
  const plansSource = source("packages/plans/src/index.ts");
  assert.equal(GRACE_DAYS, Number(plansSource.match(/export const GRACE_DAYS = (\d+)/)![1]));
  const activation = source("apps/owner/src/lib/billing/subscription.ts");
  assert.match(activation, /end\.setFullYear\(end\.getFullYear\(\) \+ 1\)/); assert.match(activation, /end\.setMonth\(end\.getMonth\(\) \+ 1\)/);
  assert.match(activation, /company\?\.plan_id === invoice\.plan_id[\s\S]*existingExpiry\.getTime\(\) > now\.getTime\(\)/);
  const baseline = source("packages/db/migrations/0001_baseline.sql").match(/CREATE TABLE plans \(([\s\S]*?)\n\);/)![1];
  assert.match(baseline, /features jsonb NOT NULL DEFAULT '\{\}'/);
  assert.match(baseline, /is_active boolean NOT NULL DEFAULT true/);
  assert.match(baseline, /sort_order int NOT NULL DEFAULT 0/);
  const defaults: Record<string, unknown> = { features: {}, is_active: true, sort_order: 0 };
  const numeric = ["price_monthly", "price_yearly", "max_outlets", "max_employees", "max_products", "max_ingredients", "max_transactions_month", "report_history_days", "email_reports_month", "storage_mb"];
  for (const key of numeric) {
    const match = baseline.match(new RegExp(`\\b${key} (?:int|numeric\\(12,2\\)) NOT NULL DEFAULT (-?\\d+)`)); assert.ok(match, key); defaults[key] = Number(match[1]);
  }
  // Interpret only the selected literal objects; no seed module imports/execution.
  const ast = ts.createSourceFile("neon-seed.ts", source("scripts/neon-seed.ts"), ts.ScriptTarget.ES2022, true);
  const bindings = new Map<string, unknown>(); let rows: Record<string, unknown>[] = [];
  const literal = (node: ts.Expression): unknown => {
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -Number(literal(node.operand));
    if (ts.isIdentifier(node) && bindings.has(node.text)) return bindings.get(node.text);
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(element => literal(element as ts.Expression));
    if (ts.isObjectLiteralExpression(node)) {
      const object: Record<string, unknown> = {};
      for (const field of node.properties) {
        if (ts.isSpreadAssignment(field)) { const value = literal(field.expression); assert.ok(value && typeof value === "object"); Object.assign(object, value); }
        else if (ts.isPropertyAssignment(field)) { assert.ok(ts.isIdentifier(field.name) || ts.isStringLiteral(field.name)); object[field.name.text] = literal(field.initializer); }
        else assert.fail("Unsupported seed literal field");
      }
      return object;
    }
    return assert.fail(`Unexpected seed expression: ${node.getText(ast)}`);
  };
  const walk = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "pro" && node.initializer) bindings.set("pro", literal(node.initializer));
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "upsert" && ts.isCallExpression(node.expression.expression)) {
      const table = node.expression.expression.arguments[0];
      if (table && ts.isStringLiteral(table) && table.text === "plans") rows = literal(node.arguments[0]) as Record<string, unknown>[];
    }
    ts.forEachChild(node, walk);
  };
  walk(ast); assert.equal(rows.length, 3);
  for (const row of rows) {
    const expected = { ...defaults, ...row }, actual = fixturePlans(NOW).find(plan => plan.slug === row.slug)!; assert.ok(actual);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key as keyof typeof actual], value, `${row.slug}.${key}`);
  }
});
