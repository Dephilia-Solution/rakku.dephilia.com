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
