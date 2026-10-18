import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import {
  claimJobs, completeJob, countJobs, enqueueJob, failJob, JobPermanentError, replayDeadLetter,
} from "./jobs";
import { storeProviderEvent } from "./provider-events";

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
const due = (ms = 1000) => new Date(Date.now() - ms);
const key = (prefix: string) => `${prefix}-${randomUUID()}`;

before(async () => {
  await pg.transaction(async tx => {
    for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
      await tx.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    }
  });
  catalog = await loadCatalog(execute);
  await execute(sql`select set_config('app.scope','platform',false)`);
});
beforeEach(async () => {
  await execute(sql`delete from app_private.job_queue`);
  await execute(sql`delete from app_private.provider_events`);
});
after(() => pg.close());

test("enqueue is unique by kind/key and returns the existing job", async () => {
  const uniqueKey = key("unique");
  const first = await enqueueJob(db, { kind: "test.kind", uniqueKey, payload: { value: 1 }, runAt: due() });
  assert.equal(first.inserted, true);
  assert.deepEqual(first.job.payload, { value: 1 });
  const second = await enqueueJob(db, { kind: "test.kind", uniqueKey, payload: { value: 2 }, runAt: due() });
  assert.equal(second.inserted, false);
  assert.equal(second.job.id, first.job.id);
  assert.deepEqual(second.job.payload, { value: 1 });
});

test("claims lease due jobs without handing the same job to a second worker", async () => {
  for (let index = 0; index < 3; index++) await enqueueJob(db, { kind: "test.claim", uniqueKey: key("claim"), runAt: due() });
  const first = await claimJobs(db, { workerId: "worker-a", limit: 2, leaseSeconds: 60 });
  assert.equal(first.length, 2);
  assert.ok(first.every(job => job.state === "leased" && job.attempts === 1 && job.locked_by === "worker-a"));
  const second = await claimJobs(db, { workerId: "worker-b", limit: 2, leaseSeconds: 60 });
  assert.equal(second.length, 1);
  assert.ok(second.every(job => job.locked_by === "worker-b"));
  assert.equal(await completeJob(db, first[0].id, "wrong-worker"), false);
  assert.equal(await completeJob(db, first[0].id, "worker-a"), true);
  assert.equal((await claimJobs(db, { workerId: "worker-c", limit: 2, leaseSeconds: 60 })).length, 0);
});

test("expired leases are reclaimed and a crash before completion cannot lose the job", async () => {
  const uniqueKey = key("lease");
  const inserted = await enqueueJob(db, { kind: "test.lease", uniqueKey, runAt: due() });
  const first = await claimJobs(db, { workerId: "crashed-worker", limit: 1, leaseSeconds: 30 });
  assert.equal(first[0].id, inserted.job.id);
  await execute(sql`update app_private.job_queue set lease_until=now() - interval '1 second' where id=${inserted.job.id}`);
  const second = await claimJobs(db, { workerId: "recovery-worker", limit: 1, leaseSeconds: 30 });
  assert.equal(second[0].id, inserted.job.id);
  assert.equal(second[0].attempts, 2);
  assert.equal(await completeJob(db, inserted.job.id, "recovery-worker"), true);
  assert.equal((await execute(sql`select state from app_private.job_queue where id=${inserted.job.id}`))[0].state, "done");
});

test("retryable failure backs off, permanent/max-attempt failure dead-letters, and replay resets safely", async () => {
  const uniqueKey = key("retry");
  const inserted = await enqueueJob(db, { kind: "test.retry", uniqueKey, runAt: due() });
  const claimed = await claimJobs(db, { workerId: "worker-retry", limit: 1, leaseSeconds: 30 });
  const now = new Date("2026-10-17T00:00:00.000Z");
  const retry = await failJob(db, {
    jobId: claimed[0].id, workerId: "worker-retry", error: new Error("temporary"), now, jitter: () => 0,
  });
  assert.equal(retry.deadLettered, false);
  assert.equal(retry.retryAt, "2026-10-17T00:00:02.000Z");
  const row = (await execute(sql`select * from app_private.job_queue where id=${inserted.job.id}`))[0];
  assert.equal(row.state, "pending");
  assert.equal(row.attempts, 1);
  await execute(sql`update app_private.job_queue set run_at=now() - interval '1 second' where id=${inserted.job.id}`);
  const second = await claimJobs(db, { workerId: "worker-retry-2", limit: 1, leaseSeconds: 30 });
  const dead = await failJob(db, {
    jobId: second[0].id, workerId: "worker-retry-2", error: new JobPermanentError("invalid identity"),
  });
  assert.equal(dead.deadLettered, true);
  const deadRow = (await execute(sql`select state,dead_lettered_at from app_private.job_queue where id=${inserted.job.id}`))[0];
  assert.equal(deadRow.state, "dead_letter");
  assert.ok(deadRow.dead_lettered_at);
  const replayed = await replayDeadLetter(db, inserted.job.id);
  assert.equal(replayed?.state, "pending");
  assert.equal(replayed?.attempts, 0);
  assert.equal(replayed?.replay_count, 1);
  assert.equal(await replayDeadLetter(db, inserted.job.id), null);
});

test("max attempts dead-letters and countJobs is read-only", async () => {
  const inserted = await enqueueJob(db, { kind: "test.max", uniqueKey: key("max"), runAt: due(), maxAttempts: 1 });
  await claimJobs(db, { workerId: "worker-max", limit: 1, leaseSeconds: 30 });
  const before = await countJobs(db);
  const failed = await failJob(db, { jobId: inserted.job.id, workerId: "worker-max", error: new Error("boom") });
  assert.equal(failed.deadLettered, true);
  const after = await countJobs(db);
  assert.equal(after.dead_letter, before.dead_letter + 1);
  assert.ok(after.pending >= before.pending);
});

test("provider event inbox dedupes by event key and enqueues exactly one webhook job", async () => {
  const eventKey = key("event");
  const first = await storeProviderEvent(db, {
    provider: "vessel", eventKey, eventType: "payment.success", transactionId: "trx-inbox",
    invoiceNumber: "INV-INBOX", payload: { payment_status: "success" }, signatureStatus: "valid",
    correlationId: "vessel:test",
  });
  assert.equal(first.inserted, true);
  const second = await storeProviderEvent(db, {
    provider: "vessel", eventKey, eventType: "payment.success", transactionId: "trx-inbox",
    invoiceNumber: "INV-INBOX", payload: { payment_status: "success" }, signatureStatus: "valid",
    correlationId: "vessel:test",
  });
  assert.equal(second.inserted, false);
  const jobs = await execute(sql`select * from app_private.job_queue where kind='vessel.webhook' and unique_key=${first.event.id}`);
  assert.equal(jobs.length, 1);
  const ignored = await storeProviderEvent(db, {
    provider: "vessel", eventKey: key("invalid"), eventType: "payment.success",
    transactionId: "trx-invalid", invoiceNumber: "INV-INVALID", payload: {}, signatureStatus: "invalid", enqueue: false,
  });
  assert.equal(ignored.inserted, true);
  assert.equal((await execute(sql`select id from app_private.job_queue where kind='vessel.webhook' and unique_key=${ignored.event.id}`)).length, 0);
});

test("private inbox and queue enforce platform-only RLS", async () => {
  await pg.exec(`CREATE ROLE job_tenant_test;
    GRANT USAGE ON SCHEMA app_private TO job_tenant_test;
    GRANT EXECUTE ON FUNCTION app_private.platform() TO job_tenant_test;
    GRANT SELECT ON app_private.provider_events,app_private.job_queue TO job_tenant_test`);
  await pg.transaction(async tx => {
    await tx.exec("SET LOCAL ROLE job_tenant_test");
    await tx.exec("select set_config('app.scope','tenant',true)");
    assert.deepEqual((await tx.query("select * from app_private.provider_events")).rows, []);
    assert.deepEqual((await tx.query("select * from app_private.job_queue")).rows, []);
  });
  const protection = await execute(sql`select relrowsecurity,relforcerowsecurity,
    not exists(select 1 from aclexplode(relacl) a where a.grantee=0) as public_revoked
    from pg_class where oid in ('app_private.provider_events'::regclass,'app_private.job_queue'::regclass)`);
  assert.ok(protection.every(row => row.relrowsecurity && row.relforcerowsecurity && row.public_revoked));
});
