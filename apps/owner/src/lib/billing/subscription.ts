import { sql, type DatabaseClient } from "@rakku/db";
import { enqueueJob } from "@rakku/db/jobs";
import {
  activateSubscriptionInvoice,
  markSubscriptionProviderPending,
  markSubscriptionProviderTerminal,
  markSubscriptionProviderUncertain,
  type ProviderPaymentDetail,
} from "@rakku/db/subscription-billing";
import {
  getPaymentStatus,
  ProviderUnavailableError,
  ProviderVerificationError,
  type VesselPaymentDetail,
} from "@rakku/vessel-client";
import type { SubscriptionInvoice } from "@rakku/shared-types";

export interface ProcessResult {
  invoice: SubscriptionInvoice;
  activated: boolean;
  reconciled: boolean;
}

export function generateInvoiceNumber(companyCode: string): string {
  const now = new Date();
  const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  return `RK-${period}-${companyCode.slice(0, 8)}-${stamp}${random}`;
}

function record(invoice: SubscriptionInvoice): SubscriptionInvoice {
  return invoice;
}

function verify(stored: SubscriptionInvoice, detail: VesselPaymentDetail): void {
  if (detail.id !== stored.provider_transaction_id
    || detail.invoice_number !== stored.invoice_number
    || Number(detail.amount) !== Number(stored.amount)) {
    throw new ProviderVerificationError("Identitas/nominal pembayaran provider tidak cocok");
  }
}

/**
 * Re-verify to the provider; webhook payload is never trusted directly.
 * Provider calls happen outside DB transactions. Unknown/timeout keeps the
 * invoice and is retried by the durable job queue or cron.
 */
export async function processInvoice(
  supabase: DatabaseClient,
  inputInvoice: SubscriptionInvoice,
  statusFetcher: (transactionId: string) => Promise<VesselPaymentDetail> = getPaymentStatus,
): Promise<ProcessResult> {
  let invoice = record(inputInvoice);
  if (invoice.status === "success") {
    return { invoice, activated: false, reconciled: !!invoice.reconciliation_reason };
  }
  if (!invoice.provider_transaction_id) {
    return { invoice, activated: false, reconciled: !!invoice.reconciliation_reason };
  }

  let detail: VesselPaymentDetail;
  try {
    detail = await statusFetcher(invoice.provider_transaction_id);
  } catch (error) {
    await markSubscriptionProviderUncertain(supabase, invoice.id, error);
    if (error instanceof ProviderUnavailableError) throw error;
    throw new ProviderUnavailableError("Status provider tidak dapat diambil; invoice dipertahankan");
  }

  try {
    verify(invoice, detail);
  } catch (error) {
    await markSubscriptionProviderUncertain(supabase, invoice.id, error);
    throw error;
  }

  if (detail.payment_status === "success") {
    const activation = await activateSubscriptionInvoice(supabase, invoice.id, detail as ProviderPaymentDetail, {
      onApplied: async (tx, result) => {
        await enqueueJob(tx, {
          kind: "subscription.payment_email",
          uniqueKey: result.invoice.id,
          correlationId: `subscription:${result.invoice.invoice_number}`,
          payload: {
            invoiceId: result.invoice.id,
            companyId: result.companyId,
            invoiceNumber: result.invoice.invoice_number,
            planName: result.planName,
            periodEnd: result.periodEnd,
            amount: result.amount,
            paidAt: result.paidAt,
          },
        });
      },
    });
    invoice = activation.invoice as unknown as SubscriptionInvoice;
    return { invoice, activated: activation.applied, reconciled: activation.reconciled };
  }

  if (["expired", "failed", "cancelled"].includes(detail.payment_status)) {
    const updated = await markSubscriptionProviderTerminal(
      supabase,
      invoice.id,
      detail.payment_status as "expired" | "failed" | "cancelled",
      detail as ProviderPaymentDetail,
    );
    return { invoice: updated as unknown as SubscriptionInvoice, activated: false, reconciled: false };
  }

  if (detail.payment_status === "pending") {
    const updated = await markSubscriptionProviderPending(supabase, invoice.id, detail as ProviderPaymentDetail);
    return { invoice: updated as unknown as SubscriptionInvoice, activated: false, reconciled: false };
  }

  await markSubscriptionProviderUncertain(supabase, invoice.id, new Error("Provider mengembalikan status yang belum dipetakan"));
  return { invoice, activated: false, reconciled: false };
}

export async function findSubscriptionInvoiceByReference(
  supabase: DatabaseClient,
  reference: { transactionId?: string | null; invoiceNumber?: string | null },
): Promise<SubscriptionInvoice | null> {
  if (!reference.transactionId && !reference.invoiceNumber) return null;
  const where = reference.transactionId
    ? sql`provider_transaction_id=${reference.transactionId}`
    : sql`invoice_number=${reference.invoiceNumber}`;
  const [row] = await supabase.execute(sql`select * from public.subscription_invoices where ${where} limit 1`);
  return row ? row as unknown as SubscriptionInvoice : null;
}
