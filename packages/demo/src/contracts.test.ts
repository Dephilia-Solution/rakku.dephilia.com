import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { DEMO_IMAGE_MIME_TYPES, MAX_DEMO_IMAGE_BYTES, QRIS_MDR_RATE, ORDER_QR_EXPIRY_MINUTES, MIN_WITHDRAWAL, WITHDRAWAL_FEE, WITHDRAWAL_DAILY_LIMIT, MAX_PENDING_WITHDRAWALS, TRANSACTION_GRACE_RATIO, TRANSACTION_GRACE_DAYS } from "./constants";
import { fixturePlans } from "./fixture";
const root = new URL("../../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");

test("audited constants and migration plan defaults cannot silently drift", () => {
  const value = (path: string, name: string) => {
    const match = source(path).match(new RegExp(`(?:const|export const) ${name} = ([\\d_.]+)`));
    assert.ok(match, name); return Number(match[1].replaceAll("_", ""));
  };
  assert.equal(QRIS_MDR_RATE, value("ledger/src/index.ts", "QRIS_MDR_RATE"));
  assert.equal(ORDER_QR_EXPIRY_MINUTES, value("payments/src/index.ts", "ORDER_QR_EXPIRY_MINUTES"));
  for (const [name, expected] of Object.entries({ MIN_WITHDRAWAL, WITHDRAWAL_FEE, WITHDRAWAL_DAILY_LIMIT, MAX_PENDING_WITHDRAWALS })) assert.equal(expected, value("../apps/owner/src/lib/billing/withdrawals.ts", name));
  assert.equal(TRANSACTION_GRACE_RATIO, value("plans/src/index.ts", "TRANSACTION_GRACE_RATIO"));
  assert.equal(TRANSACTION_GRACE_DAYS, value("plans/src/index.ts", "TRANSACTION_GRACE_DAYS"));
  for (const path of ["../apps/owner/src/app/api/owner/products/upload/route.ts", "../apps/pos/src/app/api/admin/products/upload/route.ts"]) {
    const upload = source(path), types = upload.match(/(\[[^\n]+\])\.includes\(file\.type\)/);
    assert.ok(types, "upload MIME contract"); assert.deepEqual(JSON.parse(types[1]), [...DEMO_IMAGE_MIME_TYPES]);
    const size = upload.match(/file\.size > (\d+) \* (\d+) \* (\d+)/); assert.ok(size, "upload size contract");
    assert.equal(MAX_DEMO_IMAGE_BYTES, Number(size[1]) * Number(size[2]) * Number(size[3]));
  }
  const migration = source("../supabase/migrations/025_plans_and_limits.sql");
  for (const plan of fixturePlans("2026-10-12T05:00:00Z")) {
    const match = migration.match(new RegExp(`'${plan.slug}', '[^']+', '[^']+',\\s*([\\d,\\s-]+),\\s*'([^']*)'::jsonb`));
    assert.ok(match, String(plan.slug));
    assert.deepEqual(match[1].split(",").map(n => Number(n.trim())), [plan.price_monthly, plan.price_yearly, plan.max_outlets, plan.max_employees, plan.max_products, plan.max_ingredients, plan.max_transactions_month, plan.report_history_days, plan.email_reports_month, plan.storage_mb]);
    assert.deepEqual(JSON.parse(match[2]), plan.features);
  }
});

test("production manual/draft/QRIS completion retains occupied table contract", () => {
  assert.match(source("../apps/pos/src/app/api/admin/orders/route.ts"), /\.from\("dining_tables"\)\s*\.update\(\{ status: "occupied" \}\)/);
  assert.match(source("../apps/pos/src/app/api/admin/orders/draft/route.ts"), /\.from\("dining_tables"\)\s*\.update\(\{ status: "occupied" \}\)/);
  assert.match(source("payments/src/index.ts"), /update public\.dining_tables set status='occupied'/);
});

test("domain runtime dependency graph is local and has no storage/network/timer APIs", () => {
  const files = [new URL("../index.ts", import.meta.url), ...readdirSync(new URL("./", import.meta.url)).filter(name => name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.startsWith("isolation-")).map(name => new URL(name, import.meta.url))];
  for (const file of files) {
    const contents = readFileSync(file, "utf8"), ast = ts.createSourceFile(file.pathname, contents, ts.ScriptTarget.ES2022, true);
    const walk = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) {
        const path = (node.moduleSpecifier as ts.StringLiteral).text;
        if (!node.importClause?.isTypeOnly) assert.ok(path.startsWith("."), `Runtime production dependency in ${file.pathname}: ${path}`);
        else assert.ok(path.startsWith(".") || path === "@rakku/shared-types", `Forbidden type dependency: ${path}`);
      }
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) assert.ok((node.moduleSpecifier as ts.StringLiteral).text.startsWith(".") || node.isTypeOnly, "Nonlocal export");
      if (ts.isCallExpression(node)) assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword, "Dynamic runtime import forbidden");
      if (ts.isIdentifier(node)) assert.ok(!["fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "indexedDB", "caches", "cookieStore", "document", "navigator", "setTimeout", "setInterval"].includes(node.text), `Side-effect API ${node.text} in ${file.pathname}`);
      ts.forEachChild(node, walk);
    };
    walk(ast);
  }
});

test("fresh process runs full domain with throwing production providers and browser storage", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--import", new URL("isolation-sentinel.ts", import.meta.url).href, fileURLToPath(new URL("isolation-scenario.ts", import.meta.url))], { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stderr || String(result.error)); assert.match(result.stdout, /isolated-domain-ok/);
});
