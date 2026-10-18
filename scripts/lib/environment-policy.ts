import { createHash } from "node:crypto";

export const targets = ["development", "staging", "production"] as const;
export type Target = typeof targets[number];
export type EnvironmentSnapshot = {
  label: string;
  target: Target;
  scope: "full" | "owner" | "pos" | "superadmin" | "scripts";
  values: Record<string, string>;
};
export type EnvironmentIssue = { code: string; labels: string[]; key?: string };
const secretKeys = ["OWNER_JWT_SECRET", "POS_JWT_SECRET", "NEON_AUTH_COOKIE_SECRET", "CRON_SECRET"];
const providers = ["VESSEL", "ECHO", "SILOS"];
const loopback = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");
const dbIdentity = (url: URL) => `${url.hostname.replace(/-pooler(?=\.|$)/, "")}:${url.port || "5432"}${decodeURIComponent(url.pathname)}`;

// Issues contain only fixed codes, controlled labels and variable names. Never URL/secret values.
export function auditEnvironments(snapshots: EnvironmentSnapshot[]): EnvironmentIssue[] {
  const issues: EnvironmentIssue[] = [];
  const identities: { target: Target; label: string; kind: string; key: string; identity: string }[] = [];
  const add = (code: string, snapshot: EnvironmentSnapshot, key?: string) => issues.push({ code, labels: [snapshot.label], ...(key ? { key } : {}) });
  for (const snapshot of snapshots) {
    const { values, scope, target } = snapshot;
    const full = scope === "full";
    const required = ["DATABASE_URL", "RAKKU_ENVIRONMENT",
      ...(full ? ["DATABASE_URL_UNPOOLED", "NEON_AUTH_BASE_URL", ...secretKeys, ...providers.flatMap(p => [`${p}_API_URL`, `${p}_API_KEY`, `${p}_ACCOUNT_ID`]), "VESSEL_MODE", ...["OWNER", "POS", "SUPERADMIN", "LANDING"].map(app => `NEXT_PUBLIC_${app}_URL`)] : []),
      ...(scope === "owner" ? ["OWNER_JWT_SECRET"] : []),
      ...(scope === "pos" ? ["POS_JWT_SECRET"] : []),
      ...(scope === "superadmin" ? ["NEON_AUTH_BASE_URL", "NEON_AUTH_COOKIE_SECRET"] : [])];
    for (const key of required) if (!values[key]?.trim()) add("MISSING_VALUE", snapshot, key);
    if (["owner", "pos", "superadmin"].includes(scope) && values.DATABASE_URL_UNPOOLED) add("MIGRATOR_CREDENTIAL_IN_APP_ENV", snapshot, "DATABASE_URL_UNPOOLED");
    if (values.RAKKU_ENVIRONMENT && values.RAKKU_ENVIRONMENT !== target) add("TARGET_MISMATCH", snapshot, "RAKKU_ENVIRONMENT");
    for (const key of Object.keys(values)) {
      if (/^(NEXT_PUBLIC_SUPABASE_|SUPABASE_|POSTGRES_|PGHOST$|PGUSER$|PGPASSWORD$|PGDATABASE$|SMTP_|TENANT_JWT_SECRET$|APP_PASSWORD$|EMAIL$|NEXT_PUBLIC_(TAX_RATE|STORE_|APP_URL))/.test(key)) add("OBSOLETE_KEY", snapshot, key);
      if (/^NEXT_PUBLIC_.*(SECRET|PASSWORD|PRIVATE|API_KEY|DATABASE_URL)/.test(key) && values[key]) add("PUBLIC_SECRET", snapshot, key);
    }
    const urls = new Map<string, URL>();
    for (const [key, value] of Object.entries(values)) {
      if (!value || !/^(DATABASE_URL(?:_UNPOOLED)?|NEON_AUTH_BASE_URL|(?:VESSEL|ECHO|SILOS)_API_URL|NEXT_PUBLIC_(?:OWNER|POS|SUPERADMIN|LANDING)_URL|SUPERADMIN_URL)$/.test(key)) continue;
      let url: URL;
      try { url = new URL(value); } catch { add("INVALID_URL", snapshot, key); continue; }
      // Reject malformed percent encodings before deriving a database identity.
      try { decodeURIComponent(url.pathname); } catch { add("INVALID_URL", snapshot, key); continue; }
      urls.set(key, url);
      if (key.startsWith("DATABASE_URL")) {
        if (!["postgres:", "postgresql:"].includes(url.protocol)) add("INVALID_DB_PROTOCOL", snapshot, key);
        if (target !== "development" && loopback(url.hostname)) add("REMOTE_TARGET_REQUIRED", snapshot, key);
        if (!loopback(url.hostname) && url.searchParams.get("sslmode") !== "verify-full") add("DB_TLS_VERIFY_REQUIRED", snapshot, key);
        if (!url.username || !url.password || url.pathname.length < 2) add("INCOMPLETE_DB_URL", snapshot, key);
        if (key === "DATABASE_URL") {
          if (url.username !== "rakku_runtime") add("RUNTIME_ROLE_REQUIRED", snapshot, key);
          identities.push({ target, label: snapshot.label, kind: "database", key, identity: fingerprint(dbIdentity(url)) });
        }
      } else {
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) add("INVALID_SERVICE_URL", snapshot, key);
        if ((target !== "development" || !loopback(url.hostname)) && url.protocol !== "https:") add("HTTPS_REQUIRED", snapshot, key);
        if (target !== "development" && loopback(url.hostname)) add("REMOTE_TARGET_REQUIRED", snapshot, key);
        if (key === "NEON_AUTH_BASE_URL" || key.startsWith("NEXT_PUBLIC_") || key === "SUPERADMIN_URL") identities.push({ target, label: snapshot.label, kind: key === "SUPERADMIN_URL" ? "NEXT_PUBLIC_SUPERADMIN_URL" : key, key, identity: fingerprint(`${url.origin}${url.pathname.replace(/\/$/, "")}`) });
      }
    }
    const runtime = urls.get("DATABASE_URL"), migrator = urls.get("DATABASE_URL_UNPOOLED");
    if (runtime && migrator) {
      if (dbIdentity(runtime) !== dbIdentity(migrator)) add("MIGRATOR_TARGET_MISMATCH", snapshot, "DATABASE_URL_UNPOOLED");
      if (runtime.username === migrator.username || migrator.username === "rakku_runtime") add("MIGRATOR_ROLE_NOT_SEPARATE", snapshot, "DATABASE_URL_UNPOOLED");
      if (migrator.hostname.includes("-pooler")) add("MIGRATOR_MUST_BE_DIRECT", snapshot, "DATABASE_URL_UNPOOLED");
    }
    for (const key of secretKeys) if (values[key]) {
      if (values[key].length < 32 || /^(change[-_]?me|example|placeholder|test|isolated)/i.test(values[key])) add("WEAK_OR_PLACEHOLDER_SECRET", snapshot, key);
      identities.push({ target, label: snapshot.label, kind: "auth-secret", key, identity: fingerprint(values[key]) });
    }
    for (const provider of providers) for (const suffix of ["API_KEY", "ACCOUNT_ID"]) {
      const key = `${provider}_${suffix}`;
      if (values[key]) identities.push({ target, label: snapshot.label, kind: key, key, identity: fingerprint(values[key]) });
    }
    if (values.VESSEL_MODE && values.VESSEL_MODE !== (target === "production" ? "production" : "sandbox")) add("PAYMENT_MODE_MISMATCH", snapshot, "VESSEL_MODE");
  }
  for (const snapshot of snapshots.filter(s => s.scope !== "full")) {
    const reference = snapshots.find(s => s.scope === "full" && s.target === snapshot.target);
    if (!reference) continue;
    for (const [key, value] of Object.entries(snapshot.values)) {
      if (!reference.values[key] || key === "DATABASE_URL_UNPOOLED") continue;
      // Exact target profile agreement is intentional; aliases/roles must be reviewed explicitly.
      if (value !== reference.values[key]) issues.push({ code: "PROFILE_VALUE_MISMATCH", labels: [snapshot.label, reference.label], key });
    }
  }
  const dedupe = new Set<string>();
  for (let i = 0; i < identities.length; i++) for (let j = i + 1; j < identities.length; j++) {
    const a = identities[i], b = identities[j];
    if (a.identity !== b.identity || a.kind !== b.kind) continue;
    const sameEnvironment = a.target === b.target;
    if (sameEnvironment && (a.kind !== "auth-secret" || a.key === b.key)) continue;
    const code = sameEnvironment ? "AUTH_SECRET_REUSED_BETWEEN_PURPOSES" : "RESOURCE_SHARED_BETWEEN_ENVIRONMENTS";
    const labels = [a.label, b.label].sort();
    const key = a.key === b.key ? a.key : `${a.key}/${b.key}`;
    const dedupeKey = JSON.stringify([code, labels, key]);
    if (!dedupe.has(dedupeKey)) { dedupe.add(dedupeKey); issues.push({ code, labels, key }); }
  }
  return issues;
}
