import { checked } from "@rakku/db/merchant";
import { createAdminClient, sql, type DatabaseClient } from "@rakku/db";
import {
  createQrisPayment,
  getPaymentStatus,
  ProviderUnavailableError,
  ProviderVerificationError,
  type VesselPaymentDetail,
} from "@rakku/vessel-client";
import { creditBalance } from "@rakku/ledger";
import { deductStockForOrder } from "@rakku/inventory";
import type { PaymentIntent, PaymentIntentStatus } from "@rakku/shared-types";

export const ORDER_QR_EXPIRY_MINUTES = 15;

export function generateOrderInvoiceNumber(): string {
  const now = new Date();
  const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  return `RK-ORD-${period}-${stamp}${random}`;
}

export interface CreateQrisIntentInput {
  companyId: string;
  outletId: string | null;
  orderId: string;
  amount: number;
  callbackUrl: string;
  createdBy?: string | null;
}

export type CreateQrisIntentResult =
  | { intent: PaymentIntent }
  | { error: string };

/** Buat QRIS dinamis Vessel + simpan payment intent (pending). */
export async function createQrisIntent(
  supabase: DatabaseClient,
  input: CreateQrisIntentInput,
  providerCreate: typeof createQrisPayment = createQrisPayment
): Promise<CreateQrisIntentResult> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) return { error: "Nominal QRIS harus rupiah bulat positif" };
  // Commit the invoice identity before contacting the provider. A timeout must never erase it.
  const reserved = await supabase.transaction(async tx => {
    const [order] = await tx.execute(sql`select * from public.orders where id=${input.orderId} and company_id=${input.companyId} for update`);
    if (!order || order.status !== "pending_payment" || Number(order.total_price) !== input.amount) throw new Error("Order cannot receive QRIS");
    const existing = checked(await tx.from("payment_intents").select("*").eq("order_id", input.orderId).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle());
    if (existing) return { intent: existing as PaymentIntent, fresh: false };
    const intent = checked(await tx.from("payment_intents").insert({ company_id: input.companyId, outlet_id: input.outletId,
      order_id: input.orderId, invoice_number: generateOrderInvoiceNumber(), amount: input.amount, status: "pending",
      expired_at: new Date(Date.now() + ORDER_QR_EXPIRY_MINUTES * 60000).toISOString(), created_by: input.createdBy ?? null,
    }).select().single());
    return { intent: intent as PaymentIntent, fresh: true };
  });
  if (!reserved.fresh) return reserved.intent.provider_transaction_id && reserved.intent.qr_string
    ? { intent: reserved.intent } : { error: "Status pembuatan QRIS belum pasti. Periksa order dan rekonsiliasi sebelum membuat pembayaran baru." };
  try {
    const payment = await providerCreate({ tenant_id: input.companyId, invoice_number: reserved.intent.invoice_number,
      amount: input.amount, expired_in_minutes: ORDER_QR_EXPIRY_MINUTES, callback_url: input.callbackUrl });
    if (!payment.transaction_id || payment.invoice_number !== reserved.intent.invoice_number || !payment.qr_string) throw new Error("Invalid provider response");
    const intent = checked(await supabase.from("payment_intents").update({ provider_transaction_id: payment.transaction_id,
      qr_string: payment.qr_string, expired_at: payment.expired_at, raw_payload: payment,
    }).eq("id", reserved.intent.id).select().single());
    return { intent: intent as PaymentIntent };
  } catch {
    return { error: "Pembuatan QRIS belum terkonfirmasi. Order disimpan untuk rekonsiliasi; jangan membuat pembayaran pengganti." };
  }
}

/** Only provider-confirmed terminal attempts can be retried. */
export async function expirePendingIntents(supabase: DatabaseClient, orderId: string): Promise<void> {
  const intents = checked(await supabase.from("payment_intents").select("*").eq("order_id", orderId).neq("status", "success"));
  for (const intent of intents) {
    if (!intent.provider_transaction_id) throw new Error("Pembuatan QRIS belum pasti; rekonsiliasi diperlukan");
    const result = await processOrderPayment(supabase, intent as PaymentIntent);
    if (result.intent.status === "pending") throw new Error("QRIS masih aktif di provider. Tunggu konfirmasi kedaluwarsa sebelum mencoba lagi.");
    if (result.intent.status === "success") throw new Error("Pembayaran sudah diterima. Muat ulang order.");
  }
}

export interface ProcessOrderPaymentResult {
  intent: PaymentIntent;
  finalized: boolean;
}

/**
 * Sinkronkan status QRIS order ke Vessel lalu finalisasi bila sukses.
 * Idempotent: a locked intent can reach success only once; late receipts are reconciled.
 * Only one caller
 * memfinalisasi (webhook + polling bersamaan aman). `statusFetcher` dapat
 * di-inject untuk pengujian.
 */
export async function processOrderPayment(
  supabase: DatabaseClient,
  intent: PaymentIntent,
  statusFetcher: (
    transactionId: string
  ) => Promise<VesselPaymentDetail> = getPaymentStatus,
  finalizationDatabase: () => DatabaseClient = createAdminClient
): Promise<ProcessOrderPaymentResult> {
  if (intent.status === "success" || !intent.provider_transaction_id) {
    return { intent, finalized: false };
  }

  let detail: VesselPaymentDetail;
  try {
    detail = await statusFetcher(intent.provider_transaction_id);
  } catch (error) {
    checked(await supabase.from("payment_intents").update({ updated_at: new Date().toISOString() }).eq("id", intent.id).neq("status", "success"));
    if (error instanceof ProviderUnavailableError) throw error;
    throw new ProviderUnavailableError("Status provider tidak dapat diambil; pembayaran belum direkonsiliasi");
  }

  if (detail.id !== intent.provider_transaction_id || detail.invoice_number !== intent.invoice_number || Number(detail.amount) !== Number(intent.amount)) {
    throw new ProviderVerificationError("Identitas/nominal pembayaran provider tidak cocok");
  }
  if (detail.payment_status === "success") {
    // Trusted server-only finalization after provider verification. Merchant
    // ledger writes use platform scope, while POS callers cannot mutate balances.
    return finalizationDatabase().transaction(async tx => {
      const locked = await tx.execute(sql`select * from public.payment_intents where id=${intent.id}
        and company_id=${intent.company_id} and (provider_transaction_id=${intent.provider_transaction_id} or provider_transaction_id is null) for update`);
      const current = locked[0];
      if (!current) throw new ProviderVerificationError("Payment intent tidak ditemukan");
      if (current.status === "success") return { intent: current as PaymentIntent, finalized: false };
      const orders = await tx.execute(sql`select * from public.orders where id=${current.order_id}
        and company_id=${current.company_id} and outlet_id is not distinct from ${current.outlet_id} for update`);
      const order = orders[0];
      if (!order || Number(order.total_price) !== Number(current.amount)) throw new ProviderVerificationError("Nominal pembayaran/order tidak cocok");
      if (order.status !== "pending_payment") {
        await tx.execute(sql`insert into app_private.payment_reconciliation(intent_id,company_id,order_id,amount,reason,provider_payload)
          values(${current.id},${current.company_id},${order.id},${current.amount},${order.status === "completed" ? "duplicate_payment" : "late_payment_cancelled_order"},${JSON.stringify(detail)}::jsonb)
          on conflict(intent_id) do nothing`);
        const updated = checked(await tx.from("payment_intents").update({ status: "success", paid_at: detail.paid_at ?? new Date().toISOString(),
          provider_transaction_id: intent.provider_transaction_id, raw_payload: detail }).eq("id", current.id).select().single());
        return { intent: updated as PaymentIntent, finalized: false };
      }
      const paidAt = detail.paid_at ?? new Date().toISOString();
      await tx.execute(sql`update public.orders set status='completed', payment_status='paid' where id=${order.id}`);
      await deductStockForOrder(tx, order.id, order.company_id, order.outlet_id, current.created_by);
      if (order.table_id) await tx.execute(sql`update public.dining_tables set status='occupied' where id=${order.table_id}
        and company_id=${order.company_id} and outlet_id=${order.outlet_id}`);
      const credit = await creditBalance(tx, { companyId: current.company_id, outletId: current.outlet_id,
        grossAmount: Number(current.amount), referenceType: "payment_intent", referenceId: current.id,
        note: `Pembayaran QRIS order ${order.id}`, createdBy: "system" });
      if (!credit.ok) throw new Error(credit.error ?? "Ledger credit failed");
      const updated = await tx.from("payment_intents").update({ status: "success", paid_at: paidAt, provider_transaction_id: intent.provider_transaction_id, raw_payload: detail })
        .eq("id", current.id).select().single();
      if (updated.error || !updated.data) throw new Error(updated.error?.message ?? "Payment update failed");
      return { intent: updated.data as PaymentIntent, finalized: true };
    });
  }

  if (
    detail.payment_status === "expired" ||
    detail.payment_status === "failed" ||
    detail.payment_status === "cancelled"
  ) {
    const updated = checked(await supabase.from("payment_intents").update({
      status: detail.payment_status, provider_transaction_id: intent.provider_transaction_id, raw_payload: detail,
    }).eq("id", intent.id).neq("status", "success").select().maybeSingle());
    return { intent: (updated ?? intent) as PaymentIntent, finalized: false };
  }

  const refreshed = checked(await supabase.from("payment_intents").update({ status: "pending", provider_transaction_id: intent.provider_transaction_id,
    qr_string: detail.qr_string ?? intent.qr_string, expired_at: detail.expired_at, raw_payload: detail,
  }).eq("id", intent.id).neq("status", "success").select().maybeSingle());
  return { intent: (refreshed ?? intent) as PaymentIntent, finalized: false };
}
