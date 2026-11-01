import type { DatabaseClient } from "@rakku/db";
import { JobPermanentError } from "@rakku/db/jobs";
import { markProviderEventError, markProviderEventProcessed } from "@rakku/db/provider-events";
import { processOrderPayment } from "@rakku/payments";
import { getPaymentStatus, ProviderVerificationError, type VesselPaymentDetail } from "@rakku/vessel-client";
import type { PaymentIntent, SubscriptionInvoice } from "@rakku/shared-types";
import { bindSubscriptionProviderTransaction } from "@rakku/db/subscription-billing";
import { processInvoice } from "./subscription";

type JsonLike = Record<string, unknown>;

function pick(payload: JsonLike, key: string): string | null {
  const direct = payload[key];
  if (typeof direct === "string") return direct;
  const nested = payload.data;
  if (nested && typeof nested === "object") {
    const value = (nested as JsonLike)[key];
    if (typeof value === "string") return value;
  }
  return null;
}

export interface VesselEventDependencies {
  processInvoice: typeof processInvoice;
  processOrderPayment: typeof processOrderPayment;
  statusFetcher: (transactionId: string) => Promise<VesselPaymentDetail>;
}

const defaults: VesselEventDependencies = { processInvoice, processOrderPayment, statusFetcher: getPaymentStatus };

export async function handleVesselEvent(
  db: DatabaseClient,
  event: {
    id: string;
    transaction_id: string | null;
    invoice_number: string | null;
    payload: Record<string, unknown>;
  },
  dependencies: VesselEventDependencies = defaults,
): Promise<{ kind: "order" | "subscription"; activated: boolean; reconciled: boolean }> {
  try {
    const payload = event.payload;
    const transactionId = event.transaction_id ?? pick(payload, "transaction_id") ?? pick(payload, "id");
    const invoiceNumber = event.invoice_number ?? pick(payload, "invoice_number");
    if (!transactionId && !invoiceNumber) throw new JobPermanentError("Provider event tidak memiliki transaction/invoice reference");

    let intentQuery = db.from("payment_intents").select("*").limit(1);
    intentQuery = transactionId
      ? intentQuery.eq("provider_transaction_id", transactionId)
      : intentQuery.eq("invoice_number", invoiceNumber as string);
    const intentResult = await intentQuery.maybeSingle();
    let intent = intentResult.data;
    if (intentResult.error) throw new Error("Pencarian payment intent gagal");
    if (!intent && invoiceNumber) {
      const found = await db.from("payment_intents").select("*").eq("invoice_number", invoiceNumber).maybeSingle();
      if (found.error) throw new Error("Pencarian payment intent gagal");
      intent = found.data;
    }

    if (intent) {
      await dependencies.processOrderPayment(db, {
        ...intent,
        provider_transaction_id: intent.provider_transaction_id ?? transactionId,
      } as PaymentIntent);
      await markProviderEventProcessed(db, event.id);
      return { kind: "order", activated: false, reconciled: false };
    }

    let invoiceQuery = db.from("subscription_invoices").select("*").limit(1);
    invoiceQuery = transactionId
      ? invoiceQuery.eq("provider_transaction_id", transactionId)
      : invoiceQuery.eq("invoice_number", invoiceNumber as string);
    const invoiceResult = await invoiceQuery.maybeSingle();
    let invoice = invoiceResult.data;
    if (invoiceResult.error) throw new Error("Pencarian invoice langganan gagal");
    if (!invoice && invoiceNumber) {
      const found = await db.from("subscription_invoices").select("*").eq("invoice_number", invoiceNumber).maybeSingle();
      if (found.error) throw new Error("Pencarian invoice langganan gagal");
      invoice = found.data;
    }

    if (!invoice) throw new Error("Provider event belum cocok dengan invoice atau payment intent");
    let statusFetcher = dependencies.statusFetcher;
    if (!invoice.provider_transaction_id && transactionId) {
      const detail = await statusFetcher(transactionId);
      if (detail.id !== transactionId || detail.invoice_number !== invoice.invoice_number
        || Number(detail.amount) !== Number(invoice.amount)) {
        throw new ProviderVerificationError("Callback tidak cocok dengan invoice yang belum memiliki transaksi");
      }
      await bindSubscriptionProviderTransaction(db, String(invoice.id), transactionId);
      invoice = { ...invoice, provider_transaction_id: transactionId, provider_state: "accepted" };
      statusFetcher = async () => detail;
    }
    const result = await dependencies.processInvoice(db, invoice as SubscriptionInvoice, statusFetcher);
    await markProviderEventProcessed(db, event.id);
    return { kind: "subscription", activated: result.activated, reconciled: result.reconciled };
  } catch (error) {
    await markProviderEventError(db, event.id, error);
    if (error instanceof ProviderVerificationError) throw error;
    throw error;
  }
}
