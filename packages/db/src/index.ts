import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { normalizeDatabaseUrl } from "./connection";
export { DatabaseClient, type DatabaseError, type QueryResult } from "./query";
export { sql } from "drizzle-orm";
export { normalizeDatabaseUrl } from "./connection";

type Connection = ReturnType<typeof postgres>;
const connections = new Map<string, { connection: Connection; client: DatabaseClient }>();

function executor(db: Pick<ReturnType<typeof drizzle>, "execute">) {
  return async (query: SQL): Promise<Row[]> => Array.from(await db.execute(query));
}

export async function loadCatalog(execute: (query: SQL) => Promise<Row[]>): Promise<Catalog> {
  const columns = await execute(sql`select table_name, column_name from information_schema.columns where table_schema = 'public' order by ordinal_position`);
  const keys = await execute(sql`select c.conname as name, s.relname as source, t.relname as target,
    array(select a.attname from unnest(c.conkey) with ordinality k(num, pos) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.num order by k.pos) as columns,
    array(select a.attname from unnest(c.confkey) with ordinality k(num, pos) join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.num order by k.pos) as "references",
    exists(select 1 from pg_constraint u where u.conrelid = c.conrelid and u.contype in ('u', 'p') and u.conkey = c.conkey) as "unique"
    from pg_constraint c join pg_class s on s.oid = c.conrelid join pg_class t on t.oid = c.confrelid
    join pg_namespace ns on ns.oid = s.relnamespace join pg_namespace nt on nt.oid = t.relnamespace
    where c.contype = 'f' and ns.nspname = 'public' and nt.nspname = 'public'`);
  const tables: Catalog["tables"] = {};
  for (const row of columns) (tables[row.table_name] ??= []).push(row.column_name);
  return { tables, foreignKeys: keys as Catalog["foreignKeys"] };
}

export function createAdminClient(): DatabaseClient {
  if ("window" in globalThis) throw new Error("Database clients are server-only");
  const configured = process.env.DATABASE_URL;
  if (!configured) throw new Error("DATABASE_URL is required (Neon pooled PostgreSQL connection)");
  const url = normalizeDatabaseUrl(configured);
  const existing = connections.get(url);
  if (existing) return existing.client;
  const connection = postgres(url, { max: 5, idle_timeout: 20, connect_timeout: 15, prepare: false,
    connection: { application_name: "rakku", statement_timeout: 30000 }, onnotice: () => {} });
  const db = drizzle(connection);
  const raw = executor(db);
  const execute = (query: SQL) => db.transaction(async transaction => {
    const run = executor(transaction);
    await run(sql`select set_config('app.scope', 'platform', true)`);
    return run(query);
  });
  let catalog: Promise<Catalog> | undefined;
  const getCatalog = () => catalog ??= loadCatalog(raw).catch(error => { catalog = undefined; throw error; });
  const client = new DatabaseClient(execute, getCatalog, work => db.transaction(async transaction => {
    const run = executor(transaction);
    await run(sql`select set_config('app.scope', 'platform', true)`);
    const scoped = new DatabaseClient(run, getCatalog);
    // Errors returned by query helpers must be explicitly thrown by transactional use cases.
    return work(scoped);
  }));
  connections.set(url, { connection, client });
  return client;
}

export function createTenantClient(loadScope: () => Promise<{ company_id: string; outlet_id: string; user_id: string } | null>): DatabaseClient {
  // Request-local authorization is resolved before opening a DB connection.
  // Never store this client globally or reuse it across HTTP requests.
  let scopePromise: ReturnType<typeof loadScope> | undefined;
  const getScope = () => scopePromise ??= loadScope();
  const transaction = async <T>(work: (client: DatabaseClient) => Promise<T>): Promise<T> => {
    const scope = await getScope();
    if (!scope) throw new Error("Unauthorized");
    return createAdminClient().transaction(async tx => {
      await tx.execute(sql`select set_config('app.scope','tenant',true),
        set_config('app.company_id',${scope.company_id},true),
        set_config('app.outlet_id',${scope.outlet_id},true),
        set_config('app.user_id',${scope.user_id},true)`);
      return work(tx);
    });
  };
  return new DatabaseClient(query => transaction(tx => tx.execute(query)), async () => {
    if (!await getScope()) throw new Error("Unauthorized");
    return createAdminClient().catalog();
  }, transaction);
}

export async function closeDatabase(): Promise<void> {
  await Promise.all(Array.from(connections.values()).map(({ connection }) => connection.end()));
  connections.clear();
}
