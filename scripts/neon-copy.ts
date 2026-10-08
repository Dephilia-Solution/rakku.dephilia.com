import { connect, APPLICATION_TABLES, quoteIdentifier } from "./lib/neon-config";

// Run only after all source writers, webhooks and cron jobs are stopped.
// Source is read-only. Destination must be empty; no truncate/drop is performed.
async function main() {
  const source = connect("SOURCE_DATABASE_URL");
  const target = connect("DATABASE_URL_UNPOOLED");
  try {
    if (!process.argv.includes("--write-freeze-confirmed")) throw new Error("Stop all source writers, then use --write-freeze-confirmed");
    if (process.env.SOURCE_DATABASE_URL === process.env.DATABASE_URL_UNPOOLED) throw new Error("Source and target must differ");
    await source.begin("isolation level repeatable read read only", async from => {
      await target.begin(async to => {
        await to.unsafe("select set_config('app.scope','platform',true)");
        await to.unsafe("SET CONSTRAINTS ALL DEFERRED");
        const sourceColumns = await from.unsafe<{ table_name: string; column_name: string; data_type: string }[]>(
          "select table_name,column_name,data_type from information_schema.columns where table_schema = 'public' order by ordinal_position");
        const targetColumns = await to.unsafe<{ table_name: string; column_name: string; data_type: string }[]>(
          "select table_name,column_name,data_type from information_schema.columns where table_schema = 'public' order by ordinal_position");
        const sourceTables = await from.unsafe<{ table_name: string }[]>(`select table_name from information_schema.tables t
          where table_schema='public' and table_type='BASE TABLE' and not exists (
            select 1 from pg_depend d join pg_class c on c.oid=d.objid join pg_namespace n on n.oid=c.relnamespace
            where c.relname=t.table_name and n.nspname='public' and d.deptype='e')`);
        const unmapped = sourceTables.filter(row => !(APPLICATION_TABLES as readonly string[]).includes(row.table_name));
        if (unmapped.length) throw new Error(`Unmapped source tables: ${unmapped.map(row => row.table_name).join(", ")}; reconcile the live schema first`);
        for (const table of APPLICATION_TABLES) {
          const src = sourceColumns.filter(column => column.table_name === table);
          const dst = targetColumns.filter(column => column.table_name === table);
          if (!src.length || !dst.length) throw new Error(`Missing application table: ${table}`);
          for (const column of src) {
            const destination = dst.find(item => item.column_name === column.column_name);
            if (!destination || destination.data_type !== column.data_type) throw new Error(`Schema drift at ${table}.${column.column_name}; reconcile before copying`);
          }
          const name = `public.${quoteIdentifier(table)}`;
          const existing = await to.unsafe(`SELECT 1 FROM ${name} LIMIT 1`);
          if (existing.length) throw new Error(`Target ${table} is not empty`);
          const keys = src.map(column => column.column_name);
          let total = 0;
          for await (const rows of from.unsafe<{ row: Record<string, unknown> }[]>(`SELECT to_jsonb(t) AS row FROM ${name} t`).cursor(250)) {
            const values = rows.flatMap(({ row }) => keys.map(key => {
              const value = row[key];
              return value !== null && typeof value === "object" ? JSON.stringify(value) : value;
            }));
            const placeholders = rows.map((_, rowIndex) => `(${keys.map((_, columnIndex) => `$${rowIndex * keys.length + columnIndex + 1}`).join(",")})`).join(",");
            await to.unsafe(`INSERT INTO ${name} (${keys.map(quoteIdentifier).join(",")}) VALUES ${placeholders}`, values as any[]);
            total += rows.length;
          }
          console.log(`${table}: ${total} rows copied`);
        }
        // Preserve the source sequence watermark, even when deleted orders made
        // it greater than max(order_number).
        const sequence = await from.unsafe("SELECT last_value, is_called FROM public.orders_order_number_seq");
        const maximum = await to.unsafe("select coalesce(max(order_number),0) as maximum from public.orders");
        const watermark = Math.max(Number(sequence[0].last_value), Number(maximum[0].maximum), 1);
        await to.unsafe("select setval('public.orders_order_number_seq',$1,$2)", [watermark, Boolean(sequence[0].is_called) || Number(maximum[0].maximum) > 0]);
        await to.unsafe("SET CONSTRAINTS ALL IMMEDIATE");
      });
    });
    console.log("Copy committed. Run pnpm db:check before enabling production writes.");
  } finally { await source.end(); await target.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
