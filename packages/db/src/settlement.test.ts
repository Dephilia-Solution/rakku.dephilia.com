import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import { applyBalanceTransaction, getBalance, holdBalance, finalizeWithdrawal, settleBalance } from "../../ledger/src";
import { recordSettlementReport } from "../../ledger/src/settlement";
import { updatePaymentException, PaymentExceptionError } from "./payment-exceptions";

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
const today = new Date().toISOString().slice(0, 10);

before(async () => {
  await pg.transaction(async tx => {
    for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
      await tx.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    }
  });
  catalog = await loadCatalog(execute);
  await execute(sql`select set_config('app.scope','platform',false)`);
  companyId = String((await execute(sql`insert into public.companies(code,name,password_hash)
    values('SET-A','Settlement A','hash') returning id`))[0].id);
  outletId = String((await execute(sql`insert into public.outlets(company_id,name)
    values(${companyId},'Settlement Outlet') returning id`))[0].id);
});
after(() => pg.close());

async function saleCredit(gross: number, key: string) {
  const fee = Math.round(gross * 0.007);
  const net = gross - fee;
  const result = await applyBalanceTransaction(db, {
    companyId, outletId, type: "sale_credit", amount: net, pendingDelta: 0,
    unsettledDelta: net, feeAmount: fee, referenceType: "test_sale", referenceId: key,
  });
  assert.equal(result.ok, true);
  return { fee, net };
}
async function balances() {
  return (await execute(sql`select available_balance,pending_balance,unsettled_balance
    from public.merchant_balances where company_id=${companyId}`))[0];
}

test("provider receipts remain unsettled until a matched statement releases them once", async () => {
  const sale = await saleCredit(10000, randomUUID());
  assert.equal(Number((await balances()).available_balance), 0);
  assert.equal(Number((await balances()).unsettled_balance), sale.net);
  const report = await recordSettlementReport(db, {
    provider: "vessel", providerReference: `st-${randomUUID()}`, periodStart: today, periodEnd: today,
    grossAmount: 10000, mdrAmount: sale.fee, note: "test", actor: "tester",
  });
  assert.equal(report.settled, true);
  assert.equal(report.expectedNet, sale.net);
  assert.equal(report.difference, 0);
  const after = await balances();
  assert.equal(Number(after.available_balance), sale.net);
  assert.equal(Number(after.unsettled_balance), 0);
  assert.equal((await execute(sql`select status from public.settlement_reports where id=${report.report.id}`))[0].status, "matched");
  const settledRows = await execute(sql`select settlement_report_id,settled_at from public.balance_transactions
    where company_id=${companyId} and type='sale_credit'`);
  assert.equal(settledRows[0].settlement_report_id, report.report.id);
  assert.ok(settledRows[0].settled_at);
});

test("a statement with a difference is recorded without releasing funds", async () => {
  const before = await balances();
  const sale = await saleCredit(5000, randomUUID());
  const report = await recordSettlementReport(db, {
    provider: "vessel", providerReference: `st-${randomUUID()}`, periodStart: today, periodEnd: today,
    grossAmount: 5000, mdrAmount: sale.fee + 100, note: "underpaid", actor: "tester",
  });
  assert.equal(report.settled, false);
  assert.equal(report.difference, -100);
  const after = await balances();
  assert.equal(Number(after.available_balance), Number(before.available_balance));
  assert.equal(Number(after.unsettled_balance), Number(before.unsettled_balance) + sale.net);
  assert.equal((await execute(sql`select status from public.settlement_reports where id=${report.report.id}`))[0].status, "discrepancy");
});

test("unsettled funds cannot back a withdrawal; settled available funds can be held and finalized idempotently", async () => {
  const freshCompany = String((await execute(sql`insert into public.companies(code,name,password_hash)
    values(${`WD-${randomUUID().slice(0, 8)}`},'Withdrawal Fresh','hash') returning id`))[0].id);
  const freshOutlet = String((await execute(sql`insert into public.outlets(company_id,name)
    values(${freshCompany},'Fresh Outlet') returning id`))[0].id);
  const credit = await applyBalanceTransaction(db, {
    companyId: freshCompany, outletId: freshOutlet, type: "sale_credit", amount: 9930,
    pendingDelta: 0, unsettledDelta: 9930, feeAmount: 70, referenceType: "test_sale", referenceId: randomUUID(),
  });
  assert.equal(credit.ok, true);
  const denied = await holdBalance(db, { companyId: freshCompany, amount: 100, referenceType: "withdrawal", referenceId: randomUUID() });
  assert.equal(denied.ok, false);
  const settlement = await settleBalance(db, {
    companyId: freshCompany, amount: 9930, referenceType: "test_settlement", referenceId: randomUUID(),
  });
  assert.equal(settlement.ok, true);
  const available = Number((await execute(sql`select available_balance from public.merchant_balances where company_id=${freshCompany}`))[0].available_balance);
  assert.equal(available, 9930);
  const withdrawalId = randomUUID();
  const held = await holdBalance(db, { companyId: freshCompany, amount: 100, referenceType: "withdrawal", referenceId: withdrawalId });
  assert.equal(held.ok, true);
  await execute(sql`insert into public.withdrawals(id,company_id,amount,fee,net_amount,bank_name,account_number,account_holder,status)
    values(${withdrawalId},${freshCompany},100,0,100,'Test Bank','12345678','Tester','requested')`);
  const completed = await finalizeWithdrawal(db, withdrawalId, { outcome: "completed", actor: "admin", referenceNumber: "TRX-1" });
  assert.equal(completed.status, "completed");
  const repeat = await finalizeWithdrawal(db, withdrawalId, { outcome: "completed", actor: "admin", referenceNumber: "TRX-1" });
  assert.equal(repeat.status, "completed");
  const after = (await execute(sql`select available_balance,pending_balance from public.merchant_balances where company_id=${freshCompany}`))[0];
  assert.equal(Number(after.pending_balance), 0);
  assert.equal(Number(after.available_balance), 9830);
});

test("settlement cannot release more than the unsettled balance", async () => {
  const freshCompany = String((await execute(sql`insert into public.companies(code,name,password_hash)
    values(${`SR-${randomUUID().slice(0, 8)}`},'Settlement Reversal','hash') returning id`))[0].id);
  const freshOutlet = String((await execute(sql`insert into public.outlets(company_id,name)
    values(${freshCompany},'Reversal Outlet') returning id`))[0].id);
  const fee = Math.round(1000 * 0.007);
  const net = 1000 - fee;
  await applyBalanceTransaction(db, {
    companyId: freshCompany, outletId: freshOutlet, type: "sale_credit", amount: net,
    pendingDelta: 0, unsettledDelta: net, feeAmount: fee, referenceType: "test_sale", referenceId: randomUUID(),
  });
  const before = (await execute(sql`select available_balance,unsettled_balance from public.merchant_balances where company_id=${freshCompany}`))[0];
  const over = await settleBalance(db, {
    companyId: freshCompany, amount: net + 1, referenceType: "test", referenceId: randomUUID(),
  });
  assert.equal(over.ok, false);
  const after = (await execute(sql`select available_balance,unsettled_balance from public.merchant_balances where company_id=${freshCompany}`))[0];
  assert.deepEqual(after, before);
});

test("payment exception workflow records investigation and resolution evidence without moving balances", async () => {
  const orderId = String((await execute(sql`insert into public.orders(company_id,outlet_id,subtotal,tax_amount,total_price,status,payment_status)
    values(${companyId},${outletId},100,0,100,'cancelled','unpaid') returning id`))[0].id);
  const intentId = String((await execute(sql`insert into public.payment_intents(company_id,outlet_id,order_id,invoice_number,amount,status)
    values(${companyId},${outletId},${orderId},${`EX-${randomUUID()}`},100,'success') returning id`))[0].id);
  await execute(sql`insert into app_private.payment_reconciliation(intent_id,company_id,order_id,amount,reason,provider_payload)
    values(${intentId},${companyId},${orderId},100,'late_payment_cancelled_order','{}'::jsonb)`);
  const before = await balances();
  const investigating = await updatePaymentException(db, { intentId, actor: "admin@example.test", action: "investigate" });
  assert.equal(investigating.status, "investigating");
  const resolved = await updatePaymentException(db, {
    intentId, actor: "admin@example.test", action: "resolve", note: "matched to support ticket",
    resolutionType: "manual_review", reference: "TICKET-1", proofUrl: "https://example.test/proof",
  });
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.resolution_reference, "TICKET-1");
  const repeat = await updatePaymentException(db, { intentId, actor: "other@example.test", action: "resolve", note: "ignored" });
  assert.equal(repeat.resolved_by, "admin@example.test");
  assert.deepEqual(await balances(), before);
  await assert.rejects(() => updatePaymentException(db, { intentId: randomUUID(), actor: "x", action: "investigate" }),
    (error: unknown) => error instanceof PaymentExceptionError && error.code === "NOT_FOUND");
});
