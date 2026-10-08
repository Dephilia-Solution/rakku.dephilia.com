import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parse } from "dotenv";
import assert from "node:assert/strict";

const source = parse(readFileSync(".env.neon"));
const files = [".env.local", "apps/owner/.env.local", "apps/pos/.env.local", "apps/superadmin/.env.local",
  "apps/owner/.env.production.local", "apps/pos/.env.production.local", "apps/superadmin/.env.production.local"];
for (const path of files) {
  const env = parse(readFileSync(path));
  assert.equal(env.DATABASE_URL, source.DATABASE_URL, `${path}: runtime URL mismatch`);
  const obsolete = Object.keys(env).filter(key => /^(NEXT_PUBLIC_SUPABASE_|SUPABASE_|POSTGRES_|PGHOST|PGUSER|PGPASSWORD|PGDATABASE|SMTP_|TENANT_JWT_SECRET|APP_PASSWORD|EMAIL$|NEXT_PUBLIC_(TAX_RATE|STORE_|APP_URL))/.test(key));
  assert.deepEqual(obsolete, [], `${path}: obsolete variables`);
  if (path.includes("superadmin")) {
    assert.equal(env.NEON_AUTH_BASE_URL, source.NEON_AUTH_BASE_URL, `${path}: Auth URL mismatch`);
    assert.equal(env.NEON_AUTH_COOKIE_SECRET, source.NEON_AUTH_COOKIE_SECRET, `${path}: cookie secret mismatch`);
  }
  assert.ok(execFileSync("git", ["check-ignore", path], { encoding: "utf8" }).trim(), `${path} must be ignored`);
  console.log(`${path}: synced, clean, ignored`);
}
const runtime = new URL(source.DATABASE_URL);
const migration = new URL(source.DATABASE_URL_UNPOOLED);
assert.equal(runtime.username, "rakku_runtime");
assert.notEqual(runtime.username, migration.username);
assert.equal(runtime.hostname.replace("-pooler", ""), migration.hostname);
assert.equal(runtime.pathname, migration.pathname);
assert.ok(execFileSync("git", ["check-ignore", ".env.neon"], { encoding: "utf8" }).trim());
const tracked = execFileSync("git", ["ls-files", "--", ".env*", "apps/*/.env*"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
for (const path of tracked) {
  if (!existsSync(path)) continue;
  const env = parse(readFileSync(path));
  assert.ok(!Object.keys(env).some(key => /SECRET|PASSWORD|API_KEY|DATABASE_URL|SUPABASE/.test(key)), `${path}: tracked secret variable`);
}
console.log("Environment audit passed; no credential values printed.");
