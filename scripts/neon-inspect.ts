import { connect, APPLICATION_TABLES, quoteIdentifier } from "./lib/neon-config";

async function main() {
  const db = connect("DATABASE_URL_UNPOOLED");
  try {
    const identity = await db`select current_database() as database, current_user as role,
      current_setting('server_version') as version`;
    console.log(JSON.stringify({ target: identity[0] }));
    const schemas = await db<{ schema_name: string }[]>`select schema_name from information_schema.schemata
      where schema_name in ('public','app_private','rakku_migrations','neon_auth') order by schema_name`;
    console.log(`Schemas: ${schemas.map(row => row.schema_name).join(", ")}`);
    const roles = await db`select rolname, rolcanlogin, rolbypassrls, rolsuper from pg_roles
      where rolname = 'rakku_runtime' or rolname = current_user`;
    console.log(JSON.stringify({ roles }));
    const tables = await db<{ table_name: string }[]>`select table_name from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE' order by table_name`;
    console.log(`Public tables: ${tables.map(row => row.table_name).join(", ") || "empty"}`);
    for (const { table_name: name } of tables) {
      if (!(APPLICATION_TABLES as readonly string[]).includes(name)) continue;
      const count = await db.unsafe(`select count(*)::text as count from public.${quoteIdentifier(name)}`);
      console.log(`${name}: ${count[0].count} rows`);
    }
    const authTables = await db`select count(*)::int as count from information_schema.tables where table_schema='neon_auth'`;
    console.log(`Managed Auth tables: ${authTables[0].count}`);
    if (authTables[0].count) {
      const endpoint = new URL(process.env.DATABASE_URL_UNPOOLED!);
      const auth = new URL(`https://${endpoint.hostname.replace(/^([^.]+)/, "$1.neonauth")}${endpoint.pathname}/auth`);
      try {
        const response = await fetch(new URL(`${auth.pathname}/get-session`, auth.origin), { signal: AbortSignal.timeout(20000) });
        console.log(`Managed Auth endpoint ${auth.origin}${auth.pathname}: HTTP ${response.status}`);
        if (response.ok) {
          const result = await response.json();
          console.log(`Unauthenticated session check: ${result === null || !result?.session ? "no session (expected)" : "unexpected session response"}`);
        }
      } catch (error) {
        console.log(`Managed Auth endpoint check: ${(error as { cause?: { code?: string } }).cause?.code ?? "unavailable"}`);
      }
    }
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
