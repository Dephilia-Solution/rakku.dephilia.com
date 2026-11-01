import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DatabaseClient, Row } from "./query";

export type SubscriptionInvoiceStatus = "pending" | "unknown" | "success" | "expired" | "failed" | "cancelled";
export type SubscriptionProviderState = "not_created" | "creating" | "accepted" | "unknown" | "terminal";
export type BillingCycle = "monthly" | "yearly";

export interface SubscriptionInvoiceRecord {
  id: string;
  company_id: string;
  plan_id: string;
  billing_cycle: BillingCycle;
  invoice_number: string;
  amount: number;
  provider: string;
  provider_transaction_id: string | null;
  qr_string: string | null;
  status: SubscriptionInvoiceStatus;
  expired_at: string | null;
  paid_at: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  attempt_no: number;
  provider_state: SubscriptionProviderState;
  last_error: string | null;
  provider_created_at: string | null;
  terminal_at: string | null;
  applied_at: string | null;
  applied_subscription_id: string | null;
  reconciliation_reason: string | null;
}

export interface ProviderPaymentDetail {
  id: string;
  invoice_number: string;
  payment_status: string;
  amount: string | number;
  qr_string: string | null;
  expired_at: string | null;
  paid_at: string | null;
}

export interface SubscriptionPaymentError extends Error {
  code: string;
  status: number;
}

export class SubscriptionBillingError extends Error implements SubscriptionPaymentError {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "SubscriptionBillingError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,200}$/;
const CYCLES: BillingCycle[] = ["monthly", "yearly"];

function invoice(row: Row): SubscriptionInvoiceRecord {
  return {
    ...(row as SubscriptionInvoiceRecord),
    amount: Number(row.amount),
    attempt_no: Number(row.attempt_no),
    billing_cycle: row.billing_cycle === "yearly" ? "yearly" : "monthly",
    provider_state: (row.provider_state ?? "not_created") as SubscriptionProviderState,
  };
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(bearer|api[_-]?key|secret|token)\s*[:=]\s*\S+/gi, "$1=[redacted]").slice(0, 1000);
}

export function subscriptionRequestHash(input: {
  companyId: string;
  planId: string;
  billingCycle: BillingCycle;
  amount: number;
}): string {
  return createHash("sha256").update(JSON.stringify([
    input.companyId, input.planId, input.billingCycle, Math.round(input.amount * 100),
  ])).digest("hex");
}

function validateReserve(input: {
  companyId: string;
  planId: string;
  billingCycle: BillingCycle;
  amount: number;
  invoiceNumber: string;
  requestId?: string | null;
}): void {
  if (!UUID.test(input.companyId) || !UUID.test(input.planId)) throw new SubscriptionBillingError("INVALID_ID", "ID company/plan tidak valid");
  if (!CYCLES.includes(input.billingCycle)) throw new SubscriptionBillingError("INVALID_CYCLE", "Siklus billing tidak valid");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new SubscriptionBillingError("INVALID_AMOUNT", "Nominal invoice tidak valid");
  if (!input.invoiceNumber.trim() || input.invoiceNumber.length > 80) throw new SubscriptionBillingError("INVALID_INVOICE", "Nomor invoice tidak valid");
  if (input.requestId != null && !REQUEST_ID.test(input.requestId)) {
    throw new SubscriptionBillingError("INVALID_REQUEST_ID", "Request identity tidak valid");
  }
}

export async function reserveSubscriptionInvoice(db: DatabaseClient, input: {
  companyId: string;
  planId: string;
  billingCycle: BillingCycle;
  amount: number;
  invoiceNumber: string;
  requestId?: string | null;
}): Promise<{ invoice: SubscriptionInvoiceRecord; reused: boolean; canCreateProvider: boolean }> {
  validateReserve(input);
  const requestId = input.requestId?.trim() || null;
  const hash = subscriptionRequestHash(input);
  return db.transaction(async tx => {
    const [company] = await tx.execute(sql`select id from public.companies where id=${input.companyId} for update`);
    if (!company) throw new SubscriptionBillingError("COMPANY_NOT_FOUND", "Perusahaan tidak ditemukan", 404);

    if (requestId) {
      const [mapped] = await tx.execute(sql`select i.*, r.request_hash as mapping_hash
        from app_private.subscription_payment_requests r
        join public.subscription_invoices i on i.id=r.invoice_id
        where r.company_id=${input.companyId} and r.request_id=${requestId}
        for update of i`);
      if (mapped) {
        if (mapped.mapping_hash !== hash) throw new SubscriptionBillingError("REQUEST_CONFLICT", "Request identity dipakai untuk payload berbeda", 409);
        return { invoice: invoice(mapped), reused: true, canCreateProvider: false };
      }
    }

    const [active] = await tx.execute(sql`select * from public.subscription_invoices
      where company_id=${input.companyId} and plan_id=${input.planId} and billing_cycle=${input.billingCycle}
        and status in ('pending','unknown')
        and provider_state in ('not_created','creating','accepted','unknown')
      order by created_at desc, id desc limit 1 for update`);
    if (active) {
      let selected = active;
      let canCreateProvider = false;
      if (active.provider_state === "not_created") {
        const [updated] = await tx.execute(sql`update public.subscription_invoices
          set provider_state='creating', attempt_no=attempt_no+1, updated_at=now()
          where id=${active.id} returning *`);
        selected = updated;
        canCreateProvider = true;
      }
      if (requestId) {
        await tx.execute(sql`insert into app_private.subscription_payment_requests
          (company_id,request_id,request_hash,invoice_id)
          values (${input.companyId},${requestId},${hash},${selected.id})
          on conflict (company_id,request_id) do nothing`);
      }
      return { invoice: invoice(selected), reused: true, canCreateProvider };
    }

    const [inserted] = await tx.execute(sql`insert into public.subscription_invoices
      (company_id,plan_id,billing_cycle,invoice_number,amount,provider,status,provider_state,attempt_no,created_at,updated_at)
      values (${input.companyId},${input.planId},${input.billingCycle},${input.invoiceNumber},${input.amount},
        'vessel','pending','creating',1,now(),now())
      returning *`);
    if (!inserted) throw new SubscriptionBillingError("INVOICE_NOT_CREATED", "Invoice tidak dapat dibuat", 500);
    if (requestId) {
      await tx.execute(sql`insert into app_private.subscription_payment_requests
        (company_id,request_id,request_hash,invoice_id)
        values (${input.companyId},${requestId},${hash},${inserted.id})`);
    }
    return { invoice: invoice(inserted), reused: false, canCreateProvider: true };
  });
}

function verifyDetail(stored: SubscriptionInvoiceRecord, detail: ProviderPaymentDetail): void {
  if (!stored.provider_transaction_id || stored.provider_transaction_id !== detail.id) {
    throw new SubscriptionBillingError("PROVIDER_IDENTITY_MISMATCH", "Identitas transaksi provider tidak cocok", 409);
  }
  if (stored.invoice_number !== detail.invoice_number) {
    throw new SubscriptionBillingError("PROVIDER_INVOICE_MISMATCH", "Nomor invoice provider tidak cocok", 409);
  }
  if (Number(detail.amount) !== Number(stored.amount)) {
    throw new SubscriptionBillingError("PROVIDER_AMOUNT_MISMATCH", "Nominal provider tidak cocok", 409);
  }
  if (!Number.isFinite(Number(detail.amount)) || Number(detail.amount) <= 0) {
    throw new SubscriptionBillingError("PROVIDER_AMOUNT_INVALID", "Nominal provider tidak valid", 409);
  }
}

export async function markSubscriptionProviderAccepted(db: DatabaseClient, invoiceId: string, payment: {
  transaction_id: string;
  invoice_number: string;
  qr_string: string;
  expired_at: string | null;
  amount?: string | number;
}): Promise<SubscriptionInvoiceRecord> {
  return db.transaction(async tx => {
    const [stored] = await tx.execute(sql`select * from public.subscription_invoices where id=${invoiceId} for update`);
    if (!stored) throw new SubscriptionBillingError("INVOICE_NOT_FOUND", "Invoice tidak ditemukan", 404);
    const current = invoice(stored);
    if (current.invoice_number !== payment.invoice_number) {
      throw new SubscriptionBillingError("PROVIDER_INVOICE_MISMATCH", "Nomor invoice provider tidak cocok", 409);
    }
    if (payment.amount !== undefined && Number(payment.amount) !== Number(current.amount)) {
      throw new SubscriptionBillingError("PROVIDER_AMOUNT_MISMATCH", "Nominal provider tidak cocok", 409);
    }
    if (!payment.transaction_id || !payment.qr_string) {
      throw new SubscriptionBillingError("PROVIDER_RESPONSE_INVALID", "Respons provider tidak lengkap", 502);
    }
    if (current.provider_transaction_id) {
      if (current.provider_transaction_id === payment.transaction_id) return current;
      throw new SubscriptionBillingError("PROVIDER_CONFLICT", "Invoice sudah memiliki transaksi provider lain", 409);
    }
    if (!["pending", "unknown"].includes(current.status)) {
      throw new SubscriptionBillingError("INVOICE_NOT_PENDING", "Invoice tidak dapat menerima transaksi provider", 409);
    }
    const [updated] = await tx.execute(sql`update public.subscription_invoices set
      provider_transaction_id=${payment.transaction_id}, qr_string=${payment.qr_string},
      expired_at=${payment.expired_at}, provider_state='accepted', provider_created_at=now(),
      raw_payload=${JSON.stringify(payment)}::jsonb, last_error=null, updated_at=now()
      where id=${invoiceId} returning *`);
    return invoice(updated);
  });
}

export async function bindSubscriptionProviderTransaction(
  db: DatabaseClient,
  invoiceId: string,
  transactionId: string,
): Promise<SubscriptionInvoiceRecord> {
  if (!transactionId.trim()) throw new SubscriptionBillingError("PROVIDER_IDENTITY_MISMATCH", "Transaction ID provider tidak valid", 409);
  return db.transaction(async tx => {
    const [stored] = await tx.execute(sql`select * from public.subscription_invoices where id=${invoiceId} for update`);
    if (!stored) throw new SubscriptionBillingError("INVOICE_NOT_FOUND", "Invoice tidak ditemukan", 404);
    const current = invoice(stored);
    if (current.provider_transaction_id) {
      if (current.provider_transaction_id === transactionId) return current;
      throw new SubscriptionBillingError("PROVIDER_CONFLICT", "Invoice sudah memiliki transaksi provider lain", 409);
    }
    if (!["pending", "unknown"].includes(current.status)) {
      throw new SubscriptionBillingError("INVOICE_NOT_PENDING", "Invoice tidak dapat menerima transaksi provider", 409);
    }
    const [updated] = await tx.execute(sql`update public.subscription_invoices set
      provider_transaction_id=${transactionId}, provider_state='accepted', provider_created_at=now(), updated_at=now()
      where id=${invoiceId} returning *`);
    return invoice(updated);
  });
}

export async function markSubscriptionProviderPending(db: DatabaseClient, invoiceId: string, detail: ProviderPaymentDetail): Promise<SubscriptionInvoiceRecord> {
  return db.transaction(async tx => {
    const [stored] = await tx.execute(sql`select * from public.subscription_invoices where id=${invoiceId} for update`);
    if (!stored) throw new SubscriptionBillingError("INVOICE_NOT_FOUND", "Invoice tidak ditemukan", 404);
    const current = invoice(stored);
    verifyDetail(current, detail);
    if (current.status === "success") return current;
    const [updated] = await tx.execute(sql`update public.subscription_invoices set
      provider_state='accepted', qr_string=coalesce(${detail.qr_string}, qr_string), expired_at=${detail.expired_at},
      raw_payload=${JSON.stringify(detail)}::jsonb, last_error=null, provider_created_at=coalesce(provider_created_at,now()),
      updated_at=now()
      where id=${invoiceId} returning *`);
    return invoice(updated);
  });
}

export async function markSubscriptionProviderUncertain(db: DatabaseClient, invoiceId: string, error: unknown): Promise<SubscriptionInvoiceRecord | null> {
  const [updated] = await db.execute(sql`update public.subscription_invoices set
    provider_state = case when provider_transaction_id is null then 'unknown' else provider_state end,
    last_error=${safeError(error)}, updated_at=now()
    where id=${invoiceId} and status <> 'success' returning *`);
  return updated ? invoice(updated) : null;
}

export async function markSubscriptionProviderTerminal(db: DatabaseClient, invoiceId: string, status: "expired" | "failed" | "cancelled", detail: ProviderPaymentDetail): Promise<SubscriptionInvoiceRecord> {
  return db.transaction(async tx => {
    const [stored] = await tx.execute(sql`select * from public.subscription_invoices where id=${invoiceId} for update`);
    if (!stored) throw new SubscriptionBillingError("INVOICE_NOT_FOUND", "Invoice tidak ditemukan", 404);
    const current = invoice(stored);
    verifyDetail(current, detail);
    if (current.status === "success") return current;
    const [updated] = await tx.execute(sql`update public.subscription_invoices set
      status=${status}, provider_state='terminal', terminal_at=now(),
      raw_payload=${JSON.stringify(detail)}::jsonb, last_error=null, updated_at=now()
      where id=${invoiceId} returning *`);
    return invoice(updated);
  });
}

export interface SubscriptionActivation {
  applied: boolean;
  reconciled: boolean;
  already: boolean;
  invoice: SubscriptionInvoiceRecord;
  reason: string | null;
  companyId: string;
  planId: string;
  planName: string | null;
  billingCycle: BillingCycle;
  amount: number;
  paidAt: string | null;
  subscriptionId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

function addPeriod(base: Date, cycle: BillingCycle): Date {
  const end = new Date(base);
  if (cycle === "yearly") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

export async function activateSubscriptionInvoice(db: DatabaseClient, invoiceId: string, detail: ProviderPaymentDetail, options: {
  onApplied?: (tx: DatabaseClient, activation: SubscriptionActivation) => Promise<void>;
} = {}): Promise<SubscriptionActivation> {
  if (detail.payment_status !== "success") {
    throw new SubscriptionBillingError("PROVIDER_NOT_SUCCESS", "Provider belum menyatakan pembayaran berhasil", 409);
  }
  return db.transaction(async tx => {
    const [snapshot] = await tx.execute(sql`select company_id from public.subscription_invoices where id=${invoiceId}`);
    if (!snapshot) throw new SubscriptionBillingError("INVOICE_NOT_FOUND", "Invoice tidak ditemukan", 404);
    const [companyRow] = await tx.execute(sql`select * from public.companies where id=${snapshot.company_id} for update`);
    if (!companyRow) throw new SubscriptionBillingError("COMPANY_NOT_FOUND", "Perusahaan tidak ditemukan", 404);
    const [stored] = await tx.execute(sql`select * from public.subscription_invoices where id=${invoiceId} for update`);
    if (!stored) throw new SubscriptionBillingError("INVOICE_NOT_FOUND", "Invoice tidak ditemukan", 404);
    const current = invoice(stored);
    verifyDetail(current, detail);
    if (current.company_id !== companyRow.id) throw new SubscriptionBillingError("COMPANY_MISMATCH", "Invoice bukan milik perusahaan ini", 409);

    const baseResult: SubscriptionActivation = {
      applied: false, reconciled: false, already: false, invoice: current, reason: null,
      companyId: current.company_id, planId: current.plan_id, planName: null,
      billingCycle: current.billing_cycle, amount: current.amount, paidAt: current.paid_at,
      subscriptionId: null, periodStart: null, periodEnd: null,
    };
    if (current.status === "success") {
      return { ...baseResult, already: true, reconciled: !!current.reconciliation_reason, reason: current.reconciliation_reason };
    }

    const [plan] = await tx.execute(sql`select id,name from public.plans where id=${current.plan_id}`);
    if (!plan) throw new SubscriptionBillingError("PLAN_NOT_FOUND", "Paket invoice tidak ditemukan", 404);
    const [latest] = await tx.execute(sql`select id,created_at from public.subscriptions
      where company_id=${current.company_id} order by created_at desc, id desc limit 1`);
    const paidAtDate = detail.paid_at && !Number.isNaN(Date.parse(detail.paid_at)) ? new Date(detail.paid_at) : new Date();
    const paidAt = paidAtDate.toISOString();
    const superseded = latest && new Date(latest.created_at).getTime() >= new Date(current.created_at).getTime();

    if (superseded) {
      const reason = "superseded_by_newer_activation";
      const [updated] = await tx.execute(sql`update public.subscription_invoices set
        status='success', paid_at=${paidAt}, provider_state='terminal', terminal_at=now(),
        applied_at=null, applied_subscription_id=null, reconciliation_reason=${reason},
        raw_payload=${JSON.stringify(detail)}::jsonb, last_error=null, updated_at=now()
        where id=${invoiceId} returning *`);
      await tx.execute(sql`insert into app_private.subscription_payment_journal
        (invoice_id,company_id,plan_id,billing_cycle,amount,provider,provider_transaction_id,applied,reason)
        values (${invoiceId},${current.company_id},${current.plan_id},${current.billing_cycle},${current.amount},
          ${current.provider},${detail.id},false,${reason})
        on conflict (invoice_id) do nothing`);
      await tx.execute(sql`insert into app_private.subscription_reconciliation
        (invoice_id,company_id,amount,reason,provider_payload)
        values (${invoiceId},${current.company_id},${current.amount},${reason},${JSON.stringify(detail)}::jsonb)
        on conflict (invoice_id) do nothing`);
      return {
        ...baseResult, reconciled: true, invoice: invoice(updated), reason, planName: String(plan.name), paidAt,
      };
    }

    const now = new Date();
    const existingExpiry = companyRow.plan_expires_at ? new Date(companyRow.plan_expires_at) : null;
    const samePlan = companyRow.plan_id === current.plan_id;
    const base = samePlan && existingExpiry && existingExpiry.getTime() > now.getTime() ? existingExpiry : now;
    const periodEnd = addPeriod(base, current.billing_cycle);
    const [subscription] = await tx.execute(sql`insert into public.subscriptions
      (company_id,plan_id,status,started_at,current_period_start,current_period_end)
      values (${current.company_id},${current.plan_id},'active',${paidAt},${base.toISOString()},${periodEnd.toISOString()})
      returning *`);
    if (!subscription) throw new SubscriptionBillingError("SUBSCRIPTION_NOT_CREATED", "Langganan tidak dapat dibuat", 500);
    const companyUpdate = await tx.execute(sql`update public.companies set plan_id=${current.plan_id},
      subscription_status='active', plan_expires_at=${periodEnd.toISOString()}, billing_cycle=${current.billing_cycle}
      where id=${current.company_id} returning id`);
    if (companyUpdate.length !== 1) throw new SubscriptionBillingError("COMPANY_UPDATE_FAILED", "Paket perusahaan tidak dapat diperbarui", 500);
    const [updated] = await tx.execute(sql`update public.subscription_invoices set
      status='success', paid_at=${paidAt}, provider_state='terminal', terminal_at=now(),
      applied_at=now(), applied_subscription_id=${subscription.id}, reconciliation_reason=null,
      raw_payload=${JSON.stringify(detail)}::jsonb, last_error=null, updated_at=now()
      where id=${invoiceId} returning *`);
    await tx.execute(sql`insert into app_private.subscription_payment_journal
      (invoice_id,company_id,plan_id,billing_cycle,amount,provider,provider_transaction_id,applied,reason,
        period_start,period_end,subscription_id)
      values (${invoiceId},${current.company_id},${current.plan_id},${current.billing_cycle},${current.amount},
        ${current.provider},${detail.id},true,null,${base.toISOString()},${periodEnd.toISOString()},${subscription.id})
      on conflict (invoice_id) do nothing`);
    const activation: SubscriptionActivation = {
      applied: true, reconciled: false, already: false, invoice: invoice(updated),
      reason: null, companyId: current.company_id, planId: current.plan_id, planName: String(plan.name),
      billingCycle: current.billing_cycle, amount: current.amount, paidAt,
      subscriptionId: String(subscription.id), periodStart: base.toISOString(), periodEnd: periodEnd.toISOString(),
    };
    if (options.onApplied) await options.onApplied(tx, activation);
    return activation;
  });
}
