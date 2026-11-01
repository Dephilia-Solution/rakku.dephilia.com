import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import { getProviderEvent, storeProviderEvent } from "./provider-events";
import { ProviderUnavailableError, ProviderVerificationError } from "../../vessel-client/src";
import { handleVesselEvent, type VesselEventDependencies } from "../../../apps/owner/src/lib/billing/vessel-events";

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
let planId: string;
let invoiceNumber: string;
let transactionId: string;

before(async () => {
  await pg.transaction(async tx => {
    for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
      await tx.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    }
  });
  catalog = await loadCatalog(execute);
  await execute(sql`select set_config('app.scope','platform',false)`);
  companyId = String((await execute(sql`insert into public.companies(code,name,password_hash) values('EVT-A','Event A','hash') returning id`))[0].id);
  planId = String((await execute(sql`insert into public.plans(slug,name,price_monthly,price_yearly) values('evt-pro','Event Pro',99000,990000) returning id`))[0].id);
  invoiceNumber = `EVT-${randomUUID().slice(0, 8)}`;
  transactionId = `trx-${randomUUID()}`;
  await execute(sql`insert into public.subscription_invoices
    (company_id,plan_id,billing_cycle,invoice_number,amount,provider,provider_transaction_id,status,provider_state,applied_at)
    values (${companyId},${planId},'monthly',${invoiceNumber},99000,'vessel',${transactionId},'pending','accepted',null)`);
});
after(() => pg.close());

function deps(overrides: Partial<VesselEventDependencies> = {}): VesselEventDependencies {
  return {
    processInvoice: async (_db, invoice) => ({ invoice, activated: true, reconciled: false }),
    processOrderPayment: async () => { throw new Error("order path must not run"); },
    statusFetcher: async () => { throw new Error("status fetch must not run"); },
    ...overrides,
  } as VesselEventDependencies;
}

async function event(key: string, transaction: string | null, invoice: string | null) {
  return storeProviderEvent(db, {
    provider: "vessel", eventKey: key, eventType: "payment.success",
    transactionId: transaction, invoiceNumber: invoice,
    payload: { transaction_id: transaction, invoice_number: invoice, payment_status: "success" },
    signatureStatus: "valid",
  });
}

test("matched subscription event is processed once and marked in the inbox", async () => {
  const stored = await event(`evt-${randomUUID()}`, transactionId, invoiceNumber);
  let calls = 0;
  const result = await handleVesselEvent(db, stored.event, deps({
    processInvoice: async (_db, invoice) => { calls++; return { invoice, activated: true, reconciled: false }; },
  }));
  assert.equal(result.kind, "subscription");
  assert.equal(result.activated, true);
  assert.equal(calls, 1);
  const processed = await getProviderEvent(db, stored.event.id);
  assert.ok(processed?.processed_at);
});

test("unmatched provider event is retained, marked with an error, and remains retryable", async () => {
  const stored = await event(`evt-${randomUUID()}`, `unknown-${randomUUID()}`, `unknown-${randomUUID()}`);
  await assert.rejects(() => handleVesselEvent(db, stored.event, deps()), /belum cocok/);
  const retained = await getProviderEvent(db, stored.event.id);
  assert.ok(retained);
  assert.equal(retained.processed_at, null);
  assert.match(retained.last_error ?? "", /belum cocok/);
  const jobs = await execute(sql`select id from app_private.job_queue where kind='vessel.webhook' and unique_key=${stored.event.id}`);
  assert.equal(jobs.length, 1);
});

test("permanent provider identity mismatch and transient outage remain distinguishable", async () => {
  const permanent = await event(`evt-${randomUUID()}`, transactionId, invoiceNumber);
  await assert.rejects(() => handleVesselEvent(db, permanent.event, deps({
    processInvoice: async () => { throw new ProviderVerificationError("identity mismatch"); },
  })), (error: unknown) => error instanceof ProviderVerificationError && error.retryable === false);
  const transient = await event(`evt-${randomUUID()}`, transactionId, invoiceNumber);
  await assert.rejects(() => handleVesselEvent(db, transient.event, deps({
    processInvoice: async () => { throw new ProviderUnavailableError("outage"); },
  })), (error: unknown) => error instanceof ProviderUnavailableError && error.retryable === true);
});

test("verified callback binds a pending invoice that lost the provider response, then re-verifies it", async () => {
  const lostInvoice = `EVT-LOST-${randomUUID().slice(0, 8)}`;
  const lostTransaction = `trx-lost-${randomUUID()}`;
  await execute(sql`insert into public.subscription_invoices
    (company_id,plan_id,billing_cycle,invoice_number,amount,provider,status,provider_state,applied_at)
    values (${companyId},${planId},'monthly',${lostInvoice},99000,'vessel','pending','unknown',null)`);
  const stored = await event(`evt-${randomUUID()}`, lostTransaction, lostInvoice);
  let processed = false;
  const result = await handleVesselEvent(db, stored.event, deps({
    statusFetcher: async () => ({
      id: lostTransaction, invoice_number: lostInvoice, payment_status: "success",
      amount: "99000", qr_string: "qr", expired_at: new Date(Date.now() + 3600_000).toISOString(), paid_at: new Date().toISOString(),
    }),
    processInvoice: async (_db, invoice) => {
      processed = true;
      assert.equal(invoice.provider_transaction_id, lostTransaction);
      return { invoice, activated: true, reconciled: false };
    },
  }));
  assert.equal(result.activated, true);
  assert.equal(processed, true);
  const bound = await execute(sql`select provider_transaction_id,provider_state from public.subscription_invoices where invoice_number=${lostInvoice}`);
  assert.equal(bound[0].provider_transaction_id, lostTransaction);
  assert.equal(bound[0].provider_state, "accepted");
});

test("duplicate event inserts do not enqueue a second webhook job", async () => {
  const key = `evt-${randomUUID()}`;
  const first = await event(key, transactionId, invoiceNumber);
  const second = await event(key, transactionId, invoiceNumber);
  assert.equal(first.inserted, true);
  assert.equal(second.inserted, false);
  const jobs = await execute(sql`select id from app_private.job_queue where kind='vessel.webhook' and unique_key=${first.event.id}`);
  assert.equal(jobs.length, 1);
});

test("event payload is not trusted when no database invoice or intent matches", async () => {
  const stored = await event(`evt-${randomUUID()}`, null, null);
  await assert.rejects(() => handleVesselEvent(db, stored.event, deps()), /transaction\/invoice reference/);
  const retained = await getProviderEvent(db, stored.event.id);
  assert.equal(retained?.processed_at, null);
});
