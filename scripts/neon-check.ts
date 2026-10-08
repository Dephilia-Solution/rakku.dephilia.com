import { createHash } from "node:crypto";
import { connect, APPLICATION_TABLES, quoteIdentifier } from "./lib/neon-config";

async function main() {
  const target = connect("DATABASE_URL_UNPOOLED");
  const source = process.env.SOURCE_DATABASE_URL ? connect("SOURCE_DATABASE_URL") : null;
  try {
    let failures = 0;
    await target.begin("isolation level repeatable read read only", async tx => {
      await tx.unsafe("select set_config('app.scope','platform',true)");
      for (const table of APPLICATION_TABLES) {
        const name = `public.${quoteIdentifier(table)}`;
        const rows = await tx.unsafe(`SELECT count(*)::text AS count FROM ${name}`);
        if (source) {
          const src = await source.unsafe(`SELECT count(*)::text AS count FROM ${name}`);
          if (src[0].count !== rows[0].count) { console.error(`COUNT MISMATCH: ${table}`); failures++; }
          // Common columns permit new nullable/defaulted baseline columns while
          // comparing every migrated field, including bcrypt/PIN hashes and JSON.
          const columns = await source<{ column_name: string }[]>`select column_name from information_schema.columns where table_schema='public' and table_name=${table} order by ordinal_position`;
          const projection = columns.map(column => quoteIdentifier(column.column_name)).join(",");
          async function digest(connection: typeof source) {
            const hash = createHash("sha256");
            for await (const batch of connection!.unsafe(`SELECT row_to_json(t)::text AS row FROM (SELECT ${projection} FROM ${name}) t ORDER BY row_to_json(t)::text COLLATE "C"`).cursor(250)) {
              for (const row of batch) hash.update(row.row as string).update("\n");
            }
            return hash.digest("hex");
          }
          if (await digest(source) !== await digest(tx as unknown as typeof source)) { console.error(`CONTENT MISMATCH: ${table}`); failures++; }
        }
        console.log(`${table}: ${rows[0].count} rows`);
      }
      const drift = await tx.unsafe("select count(*)::int as count from public.orders o join public.outlets t on t.id=o.outlet_id where o.company_id is distinct from t.company_id");
      if (drift[0].count) { console.error("Cross-company orders/outlets detected"); failures++; }
      const balances = await tx.unsafe(`select b.company_id from public.merchant_balances b left join
        (select company_id,sum(amount) as available,sum(pending_delta) as pending from public.balance_transactions group by company_id) l on l.company_id=b.company_id
        where b.available_balance <> coalesce(l.available,0) or b.pending_balance <> coalesce(l.pending,0)`);
      if (balances.length) { console.error(`${balances.length} merchant balance discrepancies`); failures++; }
      const payments = await tx.unsafe(`select p.id from public.payment_intents p join public.orders o on o.id=p.order_id
        where p.status='success' and (o.payment_status <> 'paid' or not exists(select 1 from public.balance_transactions b where b.company_id=p.company_id and b.reference_type='payment_intent' and b.reference_id=p.id and b.type='sale_credit'))`);
      if (payments.length) { console.error(`${payments.length} successful payment finalization discrepancies`); failures++; }
      const pending = await tx.unsafe(`select b.company_id from public.merchant_balances b left join
        (select company_id,sum(amount) as amount from public.withdrawals where status in ('requested','processing') group by company_id) w on w.company_id=b.company_id
        where b.pending_balance <> coalesce(w.amount,0)`);
      if (pending.length) { console.error(`${pending.length} withdrawal/pending balance discrepancies`); failures++; }
      const legacyImages = await tx.unsafe("select count(*)::int as count from public.products where image_url like 'https://%.supabase.co/%'");
      if (legacyImages[0].count) { console.error(`${legacyImages[0].count} products still depend on Supabase Storage; migrate source images before final copy`); failures++; }
    });
    if (failures) throw new Error(`${failures} reconciliation checks failed; keep writes disabled`);
    console.log(`Verified ${APPLICATION_TABLES.length} application tables and financial invariants.`);
  } finally { await target.end(); if (source) await source.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
