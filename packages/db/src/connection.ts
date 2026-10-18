import { getDefaultAutoSelectFamilyAttemptTimeout, setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";

export function configureDatabaseNetworking(): void {
  // postgres.js uses net.Socket without per-address connection options. Node's
  // 250ms default can abort every IPv4 attempt on higher-latency networks when
  // IPv6 is unreachable, well before the driver's overall connect_timeout.
  // This process-wide floor keeps dual-stack fallback and any longer operator
  // setting, without changing TLS verification or retrying database writes.
  if (getDefaultAutoSelectFamilyAttemptTimeout() < 1500) {
    setDefaultAutoSelectFamilyAttemptTimeout(1500);
  }
}

/** Normalize libpq Console URLs for postgres.js, which does not implement
 * channel_binding and otherwise forwards it as an invalid server GUC. TLS
 * certificate verification is retained/enforced for hosted connections. */
export function normalizeDatabaseUrl(value: string): string {
  const url = new URL(value);
  if (!["postgresql:", "postgres:"].includes(url.protocol)) throw new Error("Expected a PostgreSQL connection string");
  url.searchParams.delete("channel_binding");
  if (url.searchParams.get("sslrootcert") === "system") url.searchParams.delete("sslrootcert");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}
