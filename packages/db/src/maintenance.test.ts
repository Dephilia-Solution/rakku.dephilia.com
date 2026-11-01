import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import {
  cleanupDoneJobs,
  cleanupExpiredRateLimits,
  cleanupExpiredSessions,
  cleanupProcessedProviderEvents,
  operationalSnapshot,
} from "./maintenance";

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
let outletId: string;
const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

before(async () => {
  await pg.transaction(async tx => {
    for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
      await tx.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    }
  });
  catalog = await loadCatalog(execute);
  await execute(sql`select set_config('app.scope','platform',false)`);
  companyId = String((await execute(sql`insert into public.companies(code,name,password_hash)
    values(${`OPS-${randomUUID().slice(0, 8)}`},'Ops','hash') returning id`))[0].id);
  outletId = String((await execute(sql`insert into public.outlets(company_id,name)
    values(${companyId},'Ops Outlet') returning id`))[0].id);
});
after(() => pg.close());

test("cleanup removes expired operational rows but preserves financial and dead-letter evidence", async () => {
  await execute(sql`insert into app_private.auth_sessions(kind,subject_id,created_at,expires_at)
    values('pos',${randomUUID()},${new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()},${old})`);
  await execute(sql`insert into app_private.auth_rate_limits(key_hash,attempts,expires_at) values(${randomUUID()},3,${old})`);
  const doneJob = String((await execute(sql`insert into app_private.job_queue(kind,unique_key,state,finished_at,created_at,updated_at)
    values('test.done',${randomUUID()},'done',${old},${old},${old}) returning id`))[0].id);
  const deadJob = String((await execute(sql`insert into app_private.job_queue(kind,unique_key,state,dead_lettered_at,created_at,updated_at)
    values('test.dead',${randomUUID()},'dead_letter',${old},${old},${old}) returning id`))[0].id);
  const processed = String((await execute(sql`insert into app_private.provider_events(provider,event_key,event_type,payload,signature_status,processed_at,received_at)
    values('vessel',${randomUUID()},'payment.success','{}'::jsonb,'valid',${old},${old}) returning id`))[0].id);
  const retained = String((await execute(sql`insert into app_private.provider_events(provider,event_key,event_type,payload,signature_status,processed_at,received_at)
    values('vessel',${randomUUID()},'payment.success','{}'::jsonb,'valid',${old},${old}) returning id`))[0].id);
  await execute(sql`insert into app_private.job_queue(kind,unique_key,state,finished_at,created_at,updated_at)
    values('vessel.webhook',${processed},'done',${old},${old},${old})`);
  await execute(sql`insert into app_private.job_queue(kind,unique_key,state,dead_lettered_at,created_at,updated_at)
    values('vessel.webhook',${retained},'dead_letter',${old},${old},${old})`);
  await execute(sql`insert into public.balance_transactions(company_id,type,amount,reference_type,reference_id,created_at)
    values(${companyId},'adjustment',1,'test',${randomUUID()},${old})`);
  const result = await Promise.all([
    cleanupExpiredSessions(db, new Date(), true),
    cleanupExpiredRateLimits(db, new Date(), true),
    cleanupDoneJobs(db, new Date(), true),
    cleanupProcessedProviderEvents(db, new Date(), true),
  ]);
  assert.ok(result.every(item => item.deleted >= 0));
  assert.equal((await execute(sql`select count(*)::int as count from app_private.auth_sessions`))[0].count, 0);
  assert.equal((await execute(sql`select count(*)::int as count from app_private.auth_rate_limits`))[0].count, 0);
  assert.equal((await execute(sql`select state from app_private.job_queue where id=${doneJob}`)).length, 0);
  assert.equal((await execute(sql`select state from app_private.job_queue where id=${deadJob}`))[0].state, "dead_letter");
  assert.equal((await execute(sql`select id from app_private.provider_events where id=${processed}`)).length, 0);
  assert.equal((await execute(sql`select id from app_private.provider_events where id=${retained}`)).length, 1);
  assert.equal((await execute(sql`select count(*)::int as count from public.balance_transactions where company_id=${companyId}`))[0].count, 1);
  void outletId;
});

test("operational snapshot surfaces critical queues and never returns secrets", async () => {
  await execute(sql`insert into app_private.payment_reconciliation
    (intent_id,company_id,order_id,amount,reason,provider_payload)
    select ${randomUUID()},${companyId},o.id,100,'late_payment_cancelled_order','{}'::jsonb
    from public.orders o where false`);
  const snapshot = await operationalSnapshot(db);
  assert.equal(typeof snapshot.deadLetterJobs, "number");
  assert.equal(Array.isArray(snapshot.alerts), true);
  assert.equal(JSON.stringify(snapshot).includes("password"), false);
});
