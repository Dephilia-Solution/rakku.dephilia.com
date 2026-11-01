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
  activateSubscriptionInvoice,
  markSubscriptionProviderAccepted,
  markSubscriptionProviderTerminal,
  markSubscriptionProviderUncertain,
  reserveSubscriptionInvoice,
  SubscriptionBillingError,
  type ProviderPaymentDetail,
  type SubscriptionInvoiceRecord,
} from "./subscription-billing";

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
let companyA: string;
let companyB: string;
let planPro: string;
let planBusiness: string;
let sequence = 0;

const detail = (invoice: SubscriptionInvoiceRecord, overrides: Partial<ProviderPaymentDetail> = {}): ProviderPaymentDetail => ({
  id: invoice.provider_transaction_id ?? `trx-${randomUUID()}`,
  invoice_number: invoice.invoice_number,
  payment_status: "success",
  amount: String(invoice.amount),
  qr_string: "qr-demo",
  expired_at: new Date(Date.now() + 3600_000).toISOString(),
  paid_at: new Date().toISOString(),
  ...overrides,
});
const code = (expected: string) => (error: unknown) => error instanceof SubscriptionBillingError && error.code === expected;
const nextInvoice = (cycle: "monthly" | "yearly" = "monthly") => `INV-${++sequence}-${randomUUID().slice(0, 8)}`;

async function reserved(cycle: "monthly" | "yearly" = "monthly", requestId: string | null = null) {
  return reserveSubscriptionInvoice(db, {
    companyId: companyA, planId: planPro, billingCycle: cycle,
    amount: cycle === "yearly" ? 990000 : 99000, invoiceNumber: nextInvoice(cycle), requestId,
  });
}
async function accepted(cycle: "monthly" | "yearly" = "monthly", requestId: string | null = null) {
  const result = await reserved(cycle, requestId);
  const invoice = await markSubscriptionProviderAccepted(db, result.invoice.id, {
    transaction_id: `trx-${randomUUID()}`, invoice_number: result.invoice.invoice_number,
    qr_string: "qr-demo", expired_at: new Date(Date.now() + 3600_000).toISOString(), amount: result.invoice.amount,
  });
  return { invoice, reserved: result };
}
async function journal(invoiceId: string) {
  const [row] = await execute(sql`select * from app_private.subscription_payment_journal where invoice_id=${invoiceId}`);
  return row ?? null;
}
async function reconciliation(invoiceId: string) {
  const [row] = await execute(sql`select * from app_private.subscription_reconciliation where invoice_id=${invoiceId}`);
  return row ?? null;
}

before(async () => {
  await pg.transaction(async tx => {
    for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
      await tx.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    }
  });
  catalog = await loadCatalog(execute);
  await execute(sql`select set_config('app.scope','platform',false)`);
  companyA = String((await execute(sql`insert into public.companies(code,name,password_hash) values('SUB-A','Sub A','hash') returning id`))[0].id);
  companyB = String((await execute(sql`insert into public.companies(code,name,password_hash) values('SUB-B','Sub B','hash') returning id`))[0].id);
  planPro = String((await execute(sql`insert into public.plans(slug,name,price_monthly,price_yearly) values('sub-pro','Sub Pro',99000,990000) returning id`))[0].id);
  planBusiness = String((await execute(sql`insert into public.plans(slug,name,price_monthly,price_yearly) values('sub-business','Sub Business',249000,2490000) returning id`))[0].id);
});
beforeEach(async () => {
  await execute(sql`delete from app_private.subscription_payment_journal where company_id=${companyA}`);
  await execute(sql`delete from app_private.subscription_reconciliation where company_id=${companyA}`);
  await execute(sql`delete from public.subscription_invoices where company_id=${companyA}`);
  await execute(sql`delete from public.subscriptions where company_id=${companyA}`);
  await execute(sql`update public.companies set plan_id=null, plan_expires_at=null, subscription_status='active' where id=${companyA}`);
});
after(() => pg.close());

test("request identity dedupes checkout, rejects changed payload and binds multiple keys to one active invoice", async () => {
  const first = await reserved("monthly", "req-A");
  assert.equal(first.canCreateProvider, true);
  assert.equal(first.invoice.provider_state, "creating");
  const repeat = await reserved("monthly", "req-A");
  assert.equal(repeat.reused, true);
  assert.equal(repeat.canCreateProvider, false);
  assert.equal(repeat.invoice.id, first.invoice.id);
  await assert.rejects(() => reserveSubscriptionInvoice(db, {
    companyId: companyA, planId: planPro, billingCycle: "monthly",
    amount: 1000, invoiceNumber: nextInvoice(), requestId: "req-A",
  }), code("REQUEST_CONFLICT"));
  const otherKey = await reserved("monthly", "req-B");
  assert.equal(otherKey.reused, true);
  assert.equal(otherKey.invoice.id, first.invoice.id);
  assert.equal(otherKey.canCreateProvider, false);
  const otherCycle = await reserved("yearly", "req-C");
  assert.equal(otherCycle.reused, false);
  assert.notEqual(otherCycle.invoice.id, first.invoice.id);
});

test("provider accepted state is idempotent; conflict and mismatch cannot overwrite the invoice", async () => {
  const { invoice } = await accepted();
  const repeat = await markSubscriptionProviderAccepted(db, invoice.id, {
    transaction_id: invoice.provider_transaction_id!, invoice_number: invoice.invoice_number,
    qr_string: "qr-demo", expired_at: invoice.expired_at, amount: invoice.amount,
  });
  assert.equal(repeat.id, invoice.id);
  await assert.rejects(() => markSubscriptionProviderAccepted(db, invoice.id, {
    transaction_id: "another-trx", invoice_number: invoice.invoice_number,
    qr_string: "other", expired_at: invoice.expired_at, amount: invoice.amount,
  }), code("PROVIDER_CONFLICT"));
  const other = await reserved();
  await assert.rejects(() => markSubscriptionProviderAccepted(db, other.invoice.id, {
    transaction_id: "trx-x", invoice_number: "wrong-invoice", qr_string: "qr", expired_at: null,
  }), code("PROVIDER_INVOICE_MISMATCH"));
});

test("activation writes company/subscription/invoice/journal once even when retried", async () => {
  const { invoice } = await accepted();
  const first = await activateSubscriptionInvoice(db, invoice.id, detail(invoice));
  assert.equal(first.applied, true);
  assert.ok(first.subscriptionId);
  assert.ok(first.periodStart);
  assert.ok(first.periodEnd);
  const company = (await execute(sql`select plan_id,subscription_status,plan_expires_at from public.companies where id=${companyA}`))[0];
  assert.equal(company.plan_id, planPro);
  assert.equal(company.subscription_status, "active");
  const stored = (await execute(sql`select status,applied_at,applied_subscription_id from public.subscription_invoices where id=${invoice.id}`))[0];
  assert.equal(stored.status, "success");
  assert.ok(stored.applied_at);
  assert.equal(stored.applied_subscription_id, first.subscriptionId);
  assert.equal((await journal(invoice.id))?.applied, true);
  const repeat = await activateSubscriptionInvoice(db, invoice.id, detail(invoice));
  assert.equal(repeat.already, true);
  assert.equal(repeat.applied, false);
  const subscriptions = (await execute(sql`select id from public.subscriptions where company_id=${companyA}`)).length;
  assert.equal(subscriptions, 1);
  assert.equal((await execute(sql`select id from app_private.subscription_payment_journal where invoice_id=${invoice.id}`)).length, 1);
});

test("provider-confirmed success applies even after the local countdown has passed", async () => {
  const { invoice } = await accepted();
  await execute(sql`update public.subscription_invoices set expired_at=now() - interval '1 hour' where id=${invoice.id}`);
  const result = await activateSubscriptionInvoice(db, invoice.id, detail(invoice));
  assert.equal(result.applied, true);
});

test("older late success never downgrades a newer activation and is reconciled with an unapplied journal", async () => {
  const newer = await accepted();
  const newerActivation = await activateSubscriptionInvoice(db, newer.invoice.id, detail(newer.invoice));
  assert.equal(newerActivation.applied, true);
  const old = await accepted();
  await execute(sql`update public.subscription_invoices set created_at=now() - interval '2 hours' where id=${old.invoice.id}`);
  const result = await activateSubscriptionInvoice(db, old.invoice.id, detail(old.invoice));
  assert.equal(result.applied, false);
  assert.equal(result.reconciled, true);
  assert.equal(result.reason, "superseded_by_newer_activation");
  const stored = (await execute(sql`select status,applied_at,reconciliation_reason from public.subscription_invoices where id=${old.invoice.id}`))[0];
  assert.equal(stored.status, "success");
  assert.equal(stored.applied_at, null);
  assert.equal(stored.reconciliation_reason, "superseded_by_newer_activation");
  assert.equal((await journal(old.invoice.id))?.applied, false);
  assert.ok(await reconciliation(old.invoice.id));
  const company = (await execute(sql`select plan_id,plan_expires_at from public.companies where id=${companyA}`))[0];
  assert.equal(company.plan_id, planPro);
  assert.equal(new Date(company.plan_expires_at).toISOString(), newerActivation.periodEnd);
});

test("provider terminal status and uncertainty preserve the invoice without local expiry or activation", async () => {
  const { invoice } = await accepted();
  const terminal = await markSubscriptionProviderTerminal(db, invoice.id, "expired", detail(invoice, { payment_status: "expired" }));
  assert.equal(terminal.status, "expired");
  assert.equal(terminal.provider_state, "terminal");
  assert.equal((await execute(sql`select id from public.subscriptions where company_id=${companyA}`)).length, 0);
  const { invoice: pending } = await accepted();
  const uncertain = await markSubscriptionProviderUncertain(db, pending.id, new Error("timeout"));
  assert.equal(uncertain?.provider_state, "accepted");
  assert.ok(uncertain?.last_error);
  const created = await reserved("yearly");
  const noProvider = await markSubscriptionProviderUncertain(db, created.invoice.id, new Error("timeout"));
  assert.equal(noProvider?.provider_state, "unknown");
  assert.equal(noProvider?.status, "pending");
});

test("identity/amount mismatch cannot activate and leaves the invoice unapplied", async () => {
  const { invoice } = await accepted();
  await assert.rejects(() => activateSubscriptionInvoice(db, invoice.id, detail(invoice, { id: "foreign" })), code("PROVIDER_IDENTITY_MISMATCH"));
  await assert.rejects(() => activateSubscriptionInvoice(db, invoice.id, detail(invoice, { amount: "1" })), code("PROVIDER_AMOUNT_MISMATCH"));
  const stored = (await execute(sql`select status,applied_at from public.subscription_invoices where id=${invoice.id}`))[0];
  assert.equal(stored.status, "pending");
  assert.equal(stored.applied_at, null);
  assert.equal((await execute(sql`select id from public.subscriptions where company_id=${companyA}`)).length, 0);
});

test("journal failure rolls back company, subscription, invoice and journal together", async () => {
  const before = (await execute(sql`select plan_id,plan_expires_at from public.companies where id=${companyB}`))[0];
  const { invoice } = await reserveSubscriptionInvoice(db, {
    companyId: companyB, planId: planBusiness, billingCycle: "monthly",
    amount: 249000, invoiceNumber: nextInvoice(), requestId: "rollback-key",
  }).then(async reservedInvoice => ({
    invoice: await markSubscriptionProviderAccepted(db, reservedInvoice.invoice.id, {
      transaction_id: `trx-${randomUUID()}`, invoice_number: reservedInvoice.invoice.invoice_number,
      qr_string: "qr", expired_at: null, amount: 249000,
    }),
  }));
  await pg.exec(`CREATE FUNCTION app_private.reject_subscription_journal() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.reason IS NULL AND NEW.applied THEN RAISE EXCEPTION 'injected journal failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_subscription_journal BEFORE INSERT ON app_private.subscription_payment_journal
    FOR EACH ROW EXECUTE FUNCTION app_private.reject_subscription_journal();`);
  await assert.rejects(() => activateSubscriptionInvoice(db, invoice.id, detail(invoice)), /injected journal failure/);
  const after = (await execute(sql`select plan_id,plan_expires_at from public.companies where id=${companyB}`))[0];
  assert.deepEqual(after, before);
  assert.equal((await execute(sql`select id from public.subscriptions where company_id=${companyB}`)).length, 0);
  const stored = (await execute(sql`select status,applied_at from public.subscription_invoices where id=${invoice.id}`))[0];
  assert.equal(stored.status, "pending");
  assert.equal(stored.applied_at, null);
  assert.equal(await journal(invoice.id), null);
});

test("private subscription journal and reconciliation expose platform policies without PUBLIC access", async () => {
  const policies = await execute(sql`select polname,polcmd from pg_policy
    where polrelid in ('app_private.subscription_payment_journal'::regclass,
      'app_private.subscription_reconciliation'::regclass,
      'app_private.subscription_payment_requests'::regclass)`);
  assert.ok(policies.some(row => row.polname === "platform_append" && row.polcmd === "a"));
  assert.ok(policies.some(row => row.polname === "platform_access"));
  const protection = await execute(sql`select relrowsecurity,relforcerowsecurity,
    not exists(select 1 from aclexplode(relacl) a where a.grantee=0) as public_revoked
    from pg_class where oid in ('app_private.subscription_payment_journal'::regclass,
      'app_private.subscription_reconciliation'::regclass,
      'app_private.subscription_payment_requests'::regclass)`);
  assert.ok(protection.every(row => row.relrowsecurity && row.relforcerowsecurity && row.public_revoked));
});

test("request identity does not leak across companies and non-success details cannot activate", async () => {
  const a = await reserved("monthly", "shared-key");
  const b = await reserveSubscriptionInvoice(db, {
    companyId: companyB, planId: planBusiness, billingCycle: "monthly", amount: 249000,
    invoiceNumber: nextInvoice(), requestId: "shared-key",
  });
  assert.notEqual(a.invoice.id, b.invoice.id);
  const { invoice } = await accepted();
  await assert.rejects(() => activateSubscriptionInvoice(db, invoice.id, detail(invoice, { payment_status: "pending" })), code("PROVIDER_NOT_SUCCESS"));
});
