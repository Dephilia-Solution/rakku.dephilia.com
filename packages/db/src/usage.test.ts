import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import { getUsageCounter, releaseUsage, reserveUsage } from "./usage";

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
    values(${`USG-${randomUUID().slice(0, 8)}`},'Usage','hash') returning id`))[0].id);
});
after(() => pg.close());

test("quota reservations are atomic, bounded and releasable", async () => {
  const period = "2026-10";
  const first = await reserveUsage(db, { companyId, kind: "email_reports_month", amount: 1, limit: 2, period });
  assert.equal(first.allowed, true);
  assert.equal(first.used, 1);
  const second = await reserveUsage(db, { companyId, kind: "email_reports_month", amount: 1, limit: 2, period });
  assert.equal(second.allowed, true);
  const denied = await reserveUsage(db, { companyId, kind: "email_reports_month", amount: 1, limit: 2, period });
  assert.equal(denied.allowed, false);
  assert.equal(await getUsageCounter(db, { companyId, kind: "email_reports_month", period }), 2);
  await releaseUsage(db, { companyId, kind: "email_reports_month", amount: 1, period });
  assert.equal(await getUsageCounter(db, { companyId, kind: "email_reports_month", period }), 1);
  const afterRelease = await reserveUsage(db, { companyId, kind: "email_reports_month", amount: 1, limit: 2, period });
  assert.equal(afterRelease.allowed, true);
});

test("unlimited quota still records usage and periods are isolated", async () => {
  const a = await reserveUsage(db, { companyId, kind: "storage_mb", amount: 3, limit: -1, period: "lifetime" });
  const b = await reserveUsage(db, { companyId, kind: "storage_mb", amount: 4, limit: -1, period: "lifetime" });
  assert.equal(a.allowed, true);
  assert.equal(b.used, 7);
  assert.equal(await getUsageCounter(db, { companyId, kind: "storage_mb", period: "lifetime" }), 7);
  assert.equal(await getUsageCounter(db, { companyId, kind: "storage_mb", period: "2026-10" }), 0);
});

test("invalid quota amounts and private table access fail closed", async () => {
  await assert.rejects(() => reserveUsage(db, { companyId, kind: "x", amount: 0, limit: 1, period: "2026-10" }));
  await assert.rejects(() => reserveUsage(db, { companyId, kind: "x", amount: 1.5, limit: 1, period: "2026-10" }));
  await pg.exec(`CREATE ROLE usage_tenant_test;
    GRANT USAGE ON SCHEMA app_private TO usage_tenant_test;
    GRANT EXECUTE ON FUNCTION app_private.platform() TO usage_tenant_test;
    GRANT SELECT ON app_private.usage_counters TO usage_tenant_test`);
  await pg.transaction(async tx => {
    await tx.exec("SET LOCAL ROLE usage_tenant_test");
    await tx.exec("select set_config('app.scope','tenant',true)");
    assert.deepEqual((await tx.query("select * from app_private.usage_counters")).rows, []);
  });
});
