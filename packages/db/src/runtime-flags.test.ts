import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import { getRuntimeFlag, isCheckoutPaused, setRuntimeFlag } from "./runtime-flags";

const pg = new PGlite();
const dialect = new PgDialect();
let catalog: Catalog;
const executor = (connection: Pick<PGlite, "query">) => async (query: SQL): Promise<Row[]> => {
  const compiled = dialect.sqlToQuery(query);
  return (await connection.query<Row>(compiled.sql, compiled.params)).rows;
};
const execute = executor(pg);
const db = new DatabaseClient(execute, async () => catalog,
  work => pg.transaction(tx => work(new DatabaseClient(executor(tx), async () => catalog))));
let companyId: string;

before(async () => {
  await pg.transaction(async tx => {
    for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
      await tx.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    }
  });
  catalog = await loadCatalog(execute);
  await execute(sql`select set_config('app.scope','platform',false)`);
  companyId = String((await execute(sql`insert into public.companies(code,name,password_hash)
    values(${`FLAG-${randomUUID().slice(0, 8)}`},'Flags','hash') returning id`))[0].id);
});
after(() => pg.close());

test("checkout pause flag is default off, can be toggled and enforces env override", async () => {
  assert.equal(await getRuntimeFlag(db, "checkout_paused"), false);
  assert.equal(await isCheckoutPaused(db), false);
  await setRuntimeFlag(db, "checkout_paused", true, "operator@example.test");
  assert.equal(await isCheckoutPaused(db), true);
  await setRuntimeFlag(db, "checkout_paused", false, "operator@example.test");
  assert.equal(await isCheckoutPaused(db), false);
  process.env.RAKKU_CHECKOUT_PAUSED = "1";
  try { assert.equal(await isCheckoutPaused(db), true); }
  finally { delete process.env.RAKKU_CHECKOUT_PAUSED; }
});

test("runtime flags are platform-only under RLS", async () => {
  await pg.exec(`CREATE ROLE flag_tenant_test;
    GRANT USAGE ON SCHEMA app_private TO flag_tenant_test;
    GRANT EXECUTE ON FUNCTION app_private.platform() TO flag_tenant_test;
    GRANT SELECT,UPDATE ON app_private.runtime_flags TO flag_tenant_test`);
  await pg.transaction(async tx => {
    await tx.exec("SET LOCAL ROLE flag_tenant_test");
    await tx.exec("select set_config('app.scope','tenant',true)");
    assert.deepEqual((await tx.query("select * from app_private.runtime_flags")).rows, []);
    const update = await tx.query("update app_private.runtime_flags set enabled=true where key='checkout_paused' returning key");
    assert.equal(update.rows.length, 0);
  });
  assert.equal(await getRuntimeFlag(db, "checkout_paused"), false);
  void companyId;
});
