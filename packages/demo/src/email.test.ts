import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createDemoSandbox, DEMO_IDS, jakartaDate } from "../index";
import type { DemoCommand, DemoReportEmail } from "./models";
import type { Plan, SubscriptionInvoice } from "@rakku/shared-types";
import { fixturePlans } from "./fixture";

const NOW = "2026-10-12T05:00:00.000Z", P = DEMO_IDS.pusat, T = DEMO_IDS.taman;
function owner() { const sandbox = createDemoSandbox(new Date(NOW)); sandbox.run({ type: "session.owner" }); return sandbox; }
type Sandbox = ReturnType<typeof owner>;
function pro(sandbox: Sandbox) {
  const invoice = sandbox.run({ type: "subscription.checkout", plan: "pro", billing_cycle: "yearly" }) as SubscriptionInvoice;
  sandbox.run({ type: "subscription.transition", id: invoice.id, status: "success" });
}
function invalid(sandbox: Sandbox, command: unknown, pattern: RegExp) {
  const before = sandbox.getSnapshot(); assert.throws(() => sandbox.run(command as DemoCommand), pattern); assert.equal(sandbox.getSnapshot(), before, "preview rejection must be atomic");
}

test("filtered Pro previews exactly match salesReport and retain permitted costs and immutable metadata", () => {
  const sandbox = owner(); pro(sandbox); const today = jakartaDate(sandbox.getSnapshot().now);
  const report = sandbox.salesReport(T, today, today), before = sandbox.getSnapshot(); let notifications = 0;
  const unsubscribe = sandbox.subscribe(() => notifications++);
  const mail = sandbox.run({ type: "email.preview", email: "filtered@rakku.invalid", subject: "Today at Taman", outlet_id: T, from: today, to: today }) as DemoReportEmail;
  assert.deepEqual(mail.report, report); assert.equal(mail.report.orders, 2); assert.equal(mail.report.outlet_id, T); assert.ok(mail.report.cogs > 0);
  assert.equal(mail.to, "filtered@rakku.invalid"); assert.equal(mail.subject, "Today at Taman"); assert.equal(mail.kind, "report"); assert.equal(mail.status, "simulated");
  assert.equal(mail.created_at, before.now); assert.match(mail.body, /2026-10-12 sampai 2026-10-12/); assert.match(mail.body, /HPP/); assert.match(mail.body, /Laba bersih/);
  assert.ok(Object.isFrozen(mail.report.products)); assert.equal(notifications, 1);
  const defaults = sandbox.run({ type: "email.preview", email: "all@rakku.invalid" }) as DemoReportEmail;
  assert.deepEqual(defaults.report, sandbox.salesReport()); assert.equal(defaults.report.orders, 120); assert.equal(defaults.report.outlet_id, null);
  const legacy = sandbox.run({ type: "email.preview", to: "legacy@rakku.invalid", from: today, outlet_id: P }) as DemoReportEmail;
  assert.deepEqual(legacy.report, sandbox.salesReport(P, today)); assert.equal(legacy.to, "legacy@rakku.invalid"); unsubscribe();
});

test("POS previews use the same default/filtered outlet projection and reject cross-outlet or missing report permission", () => {
  const sandbox = owner(); pro(sandbox);
  sandbox.run({ type: "session.cashier", outlet_id: P, employee_id: "fixture:bima_pusat", pin: "222222" });
  const today = jakartaDate(sandbox.getSnapshot().now);
  const mail = sandbox.run({ type: "email.preview", email: "cashier@rakku.invalid", from: today, to: today, outlet_id: P }) as DemoReportEmail;
  assert.deepEqual(mail.report, sandbox.salesReport(P, today, today)); assert.equal(mail.report.orders, 2); assert.ok(mail.report.cogs > 0);
  assert.equal(sandbox.getSnapshot().outbox.length, 0, "outbox history remains owner-only");
  const defaults = sandbox.run({ type: "email.preview", to: "cashier@rakku.invalid" }) as DemoReportEmail;
  assert.deepEqual(defaults.report, sandbox.salesReport()); assert.equal(defaults.report.orders, 60); assert.equal(defaults.report.outlet_id, P);
  invalid(sandbox, { type: "email.preview", email: "cashier@rakku.invalid", outlet_id: T, from: today, to: today }, /Outlet access denied/);
  invalid(sandbox, { type: "email.preview", email: "cashier@rakku.invalid", outlet_id: "invalid" }, /Resource not found/);
  sandbox.run({ type: "session.owner" }); assert.equal(sandbox.getSnapshot().outbox.filter(mail => mail.kind === "report").length, 2);
  sandbox.run({ type: "entity.save", entity: "roles", value: { id: DEMO_IDS.cashier, menus: ["orders"] } });
  sandbox.run({ type: "session.cashier", outlet_id: P, employee_id: "fixture:bima_pusat", pin: "222222" });
  invalid(sandbox, { type: "email.preview", email: "cashier@rakku.invalid" }, /Menu permission denied/);
  sandbox.run({ type: "session.switchUser" }); invalid(sandbox, { type: "email.preview", email: "cashier@rakku.invalid" }, /Authentication required/);
});

test("invalid dates, history, scope and recipients emit nothing and cannot consume Pro preview quota", () => {
  const sandbox = owner(); pro(sandbox); const base = { type: "email.preview", email: "report@rakku.invalid" } as const;
  const cases: [unknown, RegExp][] = [
    [{ ...base, email: "invalid" }, /Invalid email/], [{ ...base, email: null }, /Invalid email/],
    [{ ...base, to: "other@rakku.invalid" }, /date/], [{ ...base, from: "2026-02-30" }, /calendar date/],
    [{ ...base, to: "2026-02-30" }, /calendar date/], [{ ...base, from: "2026-10-12", to: "2026-10-11" }, /range/],
    [{ ...base, from: "2020-01-01", to: "2026-10-12" }, /report_history_days/],
    [{ ...base, from: null }, /date/], [{ ...base, to: null }, /date/], [{ ...base, outlet_id: null }, /outlet ID/],
    [{ ...base, outlet_id: "unknown" }, /Resource not found/], [{ ...base, outlet_id: "" }, /outlet ID/],
    [{ ...base, subject: "x".repeat(201) }, /text/],
  ];
  for (const [command, pattern] of cases) invalid(sandbox, command, pattern);
  assert.equal(sandbox.getSnapshot().outbox.filter(mail => mail.kind === "report").length, 0);
  const first = sandbox.run(base) as DemoReportEmail; assert.deepEqual(first.report, sandbox.salesReport());
  assert.equal(sandbox.getSnapshot().outbox.filter(mail => mail.kind === "report").length, 1);
});

test("Business accepts more than Pro's 100-preview cap without altering catalog features or quota", () => {
  const sandbox = owner(); assert.equal(sandbox.getSnapshot().plans.find(plan => plan.slug === "business")!.email_reports_month, -1);
  const before = sandbox.getSnapshot().plans;
  for (let i = 0; i < 101; i++) sandbox.run({ type: "email.preview", email: "business@rakku.invalid" });
  assert.equal(sandbox.getSnapshot().outbox.filter(mail => mail.kind === "report").length, 101);
  assert.deepEqual(sandbox.getSnapshot().plans, before); assert.equal(sandbox.getSnapshot().plan, "business");
});

test("expired paid subscriptions lose email_reports while Free system notifications remain available", () => {
  const sandbox = owner(), expiry = sandbox.getSnapshot().plan_expires_at!;
  sandbox.run({ type: "tick", now: expiry }); assert.equal(sandbox.getSnapshot().subscription_status, "grace");
  sandbox.run({ type: "email.preview", email: "grace@rakku.invalid" });
  sandbox.run({ type: "tick", now: new Date(Date.parse(expiry) + 7 * 86400_000).toISOString() });
  assert.equal(sandbox.getSnapshot().plan, "free"); invalid(sandbox, { type: "email.preview", email: "expired@rakku.invalid" }, /PLAN_LIMIT: email_reports$/);
  const pending = sandbox.getSnapshot().withdrawals.find(withdrawal => withdrawal.status === "requested")!;
  sandbox.run({ type: "withdrawal.transition", id: pending.id, status: "rejected" });
  assert.ok(sandbox.getSnapshot().outbox.some(mail => mail.kind === "system" && mail.reference_id === pending.id));
  assert.equal(sandbox.getSnapshot().outbox.filter(mail => mail.kind === "report").length, 1);
});

test("read-only source audit verifies Owner's email gate, actual POS scope, and shared checkFeature flags", async () => {
  const root = new URL("../../../", import.meta.url), source = (path: string) => readFileSync(new URL(path, root), "utf8");
  const ownerRoute = source("apps/owner/src/app/api/owner/reports/send-email/route.ts");
  assert.match(ownerRoute, /await checkFeature\(supabase, session\.company_id, "email_reports"\)/);
  assert.match(ownerRoute, /if \(!feature\.allowed\)\s*\{\s*return NextResponse\.json\(feature, \{ status: 403 \}\)/);
  assert.ok(ownerRoute.indexOf("const feature =") < ownerRoute.indexOf('.from("orders")'));
  const posRoute = source("apps/pos/src/app/api/reports/send-email/route.ts");
  assert.match(posRoute, /await getTenantSessionFromCookies\(\)/); assert.match(posRoute, /if \(!session\)/);
  assert.match(posRoute, /\.eq\("company_id", session\.company_id\)/); assert.match(posRoute, /\.eq\("outlet_id", session\.outlet_id\)/);
  // POS currently has auth/outlet scope but no checkFeature call. If it adds one,
  // audit that gate too; the demo uniformly enforces the required plan feature.
  if (/\bcheckFeature\s*\(/.test(posRoute)) {
    assert.match(posRoute, /await checkFeature\([^;]*"email_reports"\)/);
    assert.match(posRoute, /if \(!feature\.allowed\)[\s\S]*status: 403/);
  }
  const plans = source("packages/plans/src/index.ts");
  assert.match(plans, /if \(hasFeature\(resolved\.plan, feature\)\) return \{ allowed: true \}/);
  assert.match(plans, /allowed: false,\s*code: "PLAN_LIMIT"/);
  const ast = ts.createSourceFile("plans.ts", plans, ts.ScriptTarget.ES2022, true);
  const predicate = ast.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "hasFeature");
  assert.ok(predicate?.body); assert.match(predicate.body.getText(ast), /return Boolean\(plan\.features\?\.\[feature\]\)/);
  const check = ast.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "checkFeature");
  assert.ok(check?.body); assert.match(check.body.getText(ast), /allowed: false,\s*code: "PLAN_LIMIT"/);
  // Compile only the selected functions. Plan resolution is a fixture-only stub;
  // no production module, client, auth, provider, or database is initialized.
  const localFunction = (node: ts.FunctionDeclaration) => ts.factory.updateFunctionDeclaration(node,
    node.modifiers?.filter(modifier => modifier.kind !== ts.SyntaxKind.ExportKeyword && modifier.kind !== ts.SyntaxKind.DefaultKeyword),
    node.asteriskToken, node.name, node.typeParameters, node.parameters, node.type, node.body);
  const printer = ts.createPrinter();
  const pure = ts.transpileModule([predicate, check].map(node => printer.printNode(ts.EmitHint.Unspecified, localFunction(node), ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const catalog = fixturePlans(NOW);
  const shared = runInNewContext(`${pure}; ({hasFeature, checkFeature})`, {
    getCompanyPlan: async (_database: unknown, planId: string) => ({ plan: catalog.find(plan => plan.id === planId)! }),
  }, { timeout: 1000 }) as { hasFeature: (plan: Plan, feature: string) => boolean; checkFeature: (database: unknown, planId: string, feature: string) => Promise<{ allowed: boolean; code?: string; feature?: string }> };
  assert.equal(catalog.find(plan => plan.slug === "free")!.email_reports_month, 5);
  assert.deepEqual(catalog.map(plan => [plan.slug, shared.hasFeature(plan, "email_reports")]), [["free", false], ["pro", true], ["business", true]]);
  for (const plan of catalog) {
    const result = await shared.checkFeature({}, plan.id, "email_reports");
    assert.equal(result.allowed, plan.slug !== "free");
    if (plan.slug === "free") { assert.equal(result.code, "PLAN_LIMIT"); assert.equal(result.feature, "email_reports"); }
  }
});
