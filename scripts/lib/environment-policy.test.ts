import assert from "node:assert/strict";
import { test } from "node:test";
import { auditEnvironments, targets, type EnvironmentSnapshot, type Target } from "./environment-policy";

function profile(target: Target): EnvironmentSnapshot {
  const values: Record<string, string> = {
    RAKKU_ENVIRONMENT: target,
    DATABASE_URL: `postgresql://rakku_runtime:synthetic@ep-${target}-pooler.neon.invalid/rakku?sslmode=verify-full`,
    DATABASE_URL_UNPOOLED: `postgresql://migrator:synthetic@ep-${target}.neon.invalid/rakku?sslmode=verify-full`,
    NEON_AUTH_BASE_URL: `https://${target}.auth.invalid`,
    VESSEL_MODE: target === "production" ? "production" : "sandbox",
  };
  for (const key of ["OWNER_JWT_SECRET", "POS_JWT_SECRET", "NEON_AUTH_COOKIE_SECRET", "CRON_SECRET"]) values[key] = `${target}-${key}-synthetic-value-at-least-32-characters`;
  for (const provider of ["VESSEL", "ECHO", "SILOS"]) {
    values[`${provider}_API_URL`] = `https://${provider.toLowerCase()}.provider.invalid`;
    values[`${provider}_API_KEY`] = `${target}-${provider}-synthetic-key`;
    values[`${provider}_ACCOUNT_ID`] = `${target}-${provider}-synthetic-account`;
  }
  for (const app of ["OWNER", "POS", "SUPERADMIN", "LANDING"]) values[`NEXT_PUBLIC_${app}_URL`] = `https://${target}.${app.toLowerCase()}.rakku.invalid`;
  return { label: target, target, scope: "full", values };
}
const codes = (snapshots: EnvironmentSnapshot[]) => auditEnvironments(snapshots).map(issue => issue.code);

test("accepts isolated environments with a shared vendor API endpoint but separate accounts/keys", () => {
  assert.deepEqual(auditEnvironments(targets.map(profile)), []);
});
test("detects a shared database despite pooler aliases and different database roles", () => {
  const dev = profile("development"), prod = profile("production");
  prod.values.DATABASE_URL = dev.values.DATABASE_URL.replace("-pooler", "");
  assert.ok(codes([dev, prod]).includes("RESOURCE_SHARED_BETWEEN_ENVIRONMENTS"));
});
test("detects shared Auth endpoint, provider account, provider key and JWT secret", () => {
  for (const key of ["NEON_AUTH_BASE_URL", "VESSEL_ACCOUNT_ID", "ECHO_API_KEY", "OWNER_JWT_SECRET"]) {
    const dev = profile("development"), staging = profile("staging");
    staging.values[key] = dev.values[key];
    assert.ok(auditEnvironments([dev, staging]).some(issue => issue.code === "RESOURCE_SHARED_BETWEEN_ENVIRONMENTS" && issue.key === key));
  }
});
test("detects secret reuse across purposes, within or across environments", () => {
  const dev = profile("development"), prod = profile("production");
  dev.values.POS_JWT_SECRET = dev.values.OWNER_JWT_SECRET;
  prod.values.NEON_AUTH_COOKIE_SECRET = dev.values.OWNER_JWT_SECRET;
  assert.ok(codes([dev, prod]).includes("AUTH_SECRET_REUSED_BETWEEN_PURPOSES"));
  assert.ok(codes([dev, prod]).includes("RESOURCE_SHARED_BETWEEN_ENVIRONMENTS"));
});
test("requires explicit environment labels and complete release profiles", () => {
  const dev = profile("development");
  delete dev.values.RAKKU_ENVIRONMENT;
  delete dev.values.SILOS_ACCOUNT_ID;
  assert.equal(codes([dev]).filter(code => code === "MISSING_VALUE").length, 2);
  dev.values.RAKKU_ENVIRONMENT = "production";
  assert.ok(codes([dev]).includes("TARGET_MISMATCH"));
});
test("requires a runtime role and separate direct migration role targeting the same database", () => {
  const prod = profile("production");
  prod.values.DATABASE_URL_UNPOOLED = prod.values.DATABASE_URL;
  assert.ok(codes([prod]).includes("MIGRATOR_ROLE_NOT_SEPARATE"));
  assert.ok(codes([prod]).includes("MIGRATOR_MUST_BE_DIRECT"));
  prod.values.DATABASE_URL_UNPOOLED = profile("staging").values.DATABASE_URL_UNPOOLED;
  assert.ok(codes([prod]).includes("MIGRATOR_TARGET_MISMATCH"));
  prod.values.DATABASE_URL = prod.values.DATABASE_URL.replace("rakku_runtime", "owner");
  assert.ok(codes([prod]).includes("RUNTIME_ROLE_REQUIRED"));
});
test("requires verified remote TLS and HTTPS, allows only development loopback HTTP", () => {
  const dev = profile("development"), prod = profile("production");
  dev.values.NEON_AUTH_BASE_URL = "http://localhost:4000";
  assert.deepEqual(auditEnvironments([dev]), []);
  prod.values.NEON_AUTH_BASE_URL = "http://localhost:4000";
  prod.values.DATABASE_URL = prod.values.DATABASE_URL.replace("verify-full", "require");
  assert.ok(codes([prod]).includes("HTTPS_REQUIRED"));
  assert.ok(codes([prod]).includes("REMOTE_TARGET_REQUIRED"));
  assert.ok(codes([prod]).includes("DB_TLS_VERIFY_REQUIRED"));
});
test("rejects weak secrets, exposed public secrets, legacy keys and payment mode mismatch", () => {
  const prod = profile("production");
  prod.values.OWNER_JWT_SECRET = "changeme";
  prod.values.NEXT_PUBLIC_PRIVATE_API_KEY = "sensitive";
  prod.values.SUPABASE_SERVICE_ROLE_KEY = "sensitive";
  prod.values.VESSEL_MODE = "sandbox";
  for (const code of ["WEAK_OR_PLACEHOLDER_SECRET", "PUBLIC_SECRET", "OBSOLETE_KEY", "PAYMENT_MODE_MISMATCH"]) assert.ok(codes([prod]).includes(code));
});
test("fails closed for malformed URLs without returning credentials in diagnostics", () => {
  const prod = profile("production"), marker = "NEVER-PRINT-THIS-PASSWORD";
  prod.values.DATABASE_URL = `postgresql://user:${marker}@host.invalid/%zz`;
  prod.values.NEON_AUTH_BASE_URL = marker;
  const result = auditEnvironments([prod]);
  assert.ok(result.some(issue => issue.code === "INVALID_URL"));
  assert.ok(!JSON.stringify(result).includes(marker));
  assert.ok(!JSON.stringify(result).includes("host.invalid"));
});
test("requires effective app files to match the reviewed profile for that environment", () => {
  const dev = profile("development");
  const app: EnvironmentSnapshot = { label: "owner", target: "development", scope: "owner", values: { ...dev.values, OWNER_JWT_SECRET: "a-different-but-long-synthetic-secret-value" } };
  assert.ok(codes([dev, app]).includes("PROFILE_VALUE_MISMATCH"));
  app.values = { ...dev.values };
  delete app.values.DATABASE_URL_UNPOOLED;
  assert.deepEqual(auditEnvironments([dev, app]), []);
});
test("flags production builds inheriting development credentials from .env.local", () => {
  const dev = profile("development");
  const build: EnvironmentSnapshot = { ...dev, label: "owner production effective", target: "production", scope: "owner" };
  assert.ok(codes([dev, build]).includes("TARGET_MISMATCH"));
  assert.ok(codes([dev, build]).includes("RESOURCE_SHARED_BETWEEN_ENVIRONMENTS"));
});

test("rejects migration credentials in application runtime files", () => {
  const app: EnvironmentSnapshot = { ...profile("development"), scope: "owner" };
  assert.ok(codes([app]).includes("MIGRATOR_CREDENTIAL_IN_APP_ENV"));
});
