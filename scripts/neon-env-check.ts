import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parse } from "dotenv";
import { auditEnvironments, targets, type EnvironmentSnapshot, type Target } from "./lib/environment-policy";

// Read-only: no DB connections, provider requests, env copying or process.env loading.
// Paths in diagnostics are controlled below; file contents are never printed, including failures.
const snapshots: EnvironmentSnapshot[] = [];
let failures = 0;
const report = (code: string, label: string) => { console.error(`${code}: ${label}`); failures++; };
const read = (path: string): Record<string, string> => {
  try { return parse(readFileSync(path)); } catch { report("UNREADABLE_ENV_FILE", path); return {}; }
};
function requireIgnored(path: string) {
  try { execFileSync("git", ["check-ignore", "--quiet", "--", path], { stdio: "ignore" }); }
  catch { report("CREDENTIAL_FILE_NOT_IGNORED", path); }
}
for (const target of targets) {
  const path = `config/environments/${target}.env.local`;
  if (!existsSync(path)) { report("MISSING_ISOLATION_PROFILE", path); continue; }
  requireIgnored(path);
  snapshots.push({ label: path, target, scope: "full", values: read(path) });
}
// Model Next's actual precedence for build/start; .env.local is also read in production.
// A dedicated staging profile is checked above and must be explicitly injected by CI.
for (const app of ["owner", "pos", "superadmin"] as const) for (const target of ["development", "production"] as const) {
  const base = `apps/${app}/`;
  const files = [".env", `.env.${target}`, ".env.local", `.env.${target}.local`].map(file => base + file).filter(existsSync);
  if (!files.length) continue;
  let values: Record<string, string> = {};
  for (const path of files) {
    const contents = read(path);
    if (Object.entries(contents).some(([key, value]) => /SECRET|PASSWORD|API_KEY|DATABASE_URL/.test(key) && value.trim())) requireIgnored(path);
    values = { ...values, ...contents };
  }
  snapshots.push({ label: `${app}:${target} effective files`, target, scope: app, values });
}
for (const path of [".env.local", ".env.neon"]) if (existsSync(path)) {
  requireIgnored(path);
  const values = read(path);
  const declared = values.RAKKU_ENVIRONMENT;
  if (!targets.includes(declared as Target)) report("ROOT_ENV_TARGET_UNDECLARED", path);
  snapshots.push({ label: path, target: targets.includes(declared as Target) ? declared as Target : "development", scope: "scripts", values });
}
try {
  const tracked = execFileSync("git", ["ls-files", "--", ".env*", "apps/*/.env*", "config/environments/*env*"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  for (const path of tracked) if (existsSync(path)) {
    const values = read(path);
    if (Object.entries(values).some(([key, value]) => /SECRET|PASSWORD|API_KEY|DATABASE_URL|SUPABASE/.test(key) && value.trim())) report("TRACKED_SECRET_VALUE", path);
  }
} catch { report("TRACKED_ENV_SCAN_FAILED", "git metadata"); }
const issues = auditEnvironments(snapshots);
for (const issue of issues) report(issue.code, `${issue.labels.join(" <-> ")}${issue.key ? ` [${issue.key}]` : ""}`);
console.log(`Environment isolation: ${snapshots.length} snapshots, ${failures} issue(s). No credential values printed; no external services contacted.`);
process.exitCode = failures ? 1 : 0;
