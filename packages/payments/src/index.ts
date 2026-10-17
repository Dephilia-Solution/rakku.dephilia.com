import { createAdminClient, sql, type DatabaseClient } from "@rakku/db";
import {
  createQrisPayment,
  getPaymentStatus,
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
  input: CreateQrisIntentInput
): Promise<CreateQrisIntentResult> {
  const invoiceNumber = generateOrderInvoiceNumber();

  let payment;
  try {
    payment = await createQrisPayment({
      tenant_id: input.companyId,
      invoice_number: invoiceNumber,
      amount: input.amount,
      expired_in_minutes: ORDER_QR_EXPIRY_MINUTES,
      callback_url: input.callbackUrl,
    });
  } catch (err) {
    console.error("[payments] gagal membuat QRIS:", err);
    return { error: "Gagal membuat QRIS. Coba lagi." };
  }

  const { data, error } = await supabase
    .from("payment_intents")
    .insert({
      company_id: input.companyId,
      outlet_id: input.outletId,
      order_id: input.orderId,
      provider: "vessel",
      provider_transaction_id: payment.transaction_id,
      invoice_number: invoiceNumber,
      amount: input.amount,
      qr_string: payment.qr_string,
      status: "pending",
      expired_at: payment.expired_at,
      raw_payload: payment,
      created_by: input.createdBy ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[payments] gagal menyimpan payment intent:", error);
    return { error: "Gagal menyimpan payment intent" };
  }

  return { intent: data as PaymentIntent };
}

/** Batalkan semua intent pending untuk satu order (retry/cancel). */
export async function expirePendingIntents(
  supabase: DatabaseClient,
  orderId: string
): Promise<void> {
  await supabase
    .from("payment_intents")
    .update({ status: "cancelled" })
    .eq("order_id", orderId)
    .eq("status", "pending");
}

export interface ProcessOrderPaymentResult {
  intent: PaymentIntent;
  finalized: boolean;
}

/**
 * Sinkronkan status QRIS order ke Vessel lalu finalisasi bila sukses.
 * Idempotent: atomic claim `status=pending` → hanya satu pemanggil yang
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
  if (intent.status !== "pending" || !intent.provider_transaction_id) {
    return { intent, finalized: false };
  }

  let detail: VesselPaymentDetail;
  try {
    detail = await statusFetcher(intent.provider_transaction_id);
  } catch {
    return { intent, finalized: false };
  }

  if (detail.payment_status === "success") {
    if (detail.invoice_number !== intent.invoice_number || Number(detail.amount) !== Number(intent.amount)) {
      throw new Error("Provider payment does not match the stored invoice/amount");
    }
    // Trusted server-only finalization after provider verification. Merchant
    // ledger writes use platform scope, while POS callers cannot mutate balances.
    return finalizationDatabase().transaction(async tx => {
      const locked = await tx.execute(sql`select * from public.payment_intents where id=${intent.id}
        and company_id=${intent.company_id} and provider_transaction_id=${intent.provider_transaction_id} for update`);
      const current = locked[0];
      if (!current) throw new Error("Payment intent not found");
      if (current.status !== "pending") return { intent: current as PaymentIntent, finalized: false };
      const orders = await tx.execute(sql`select * from public.orders where id=${current.order_id}
        and company_id=${current.company_id} and outlet_id is not distinct from ${current.outlet_id} for update`);
      const order = orders[0];
      if (!order || order.status !== "pending_payment" || Number(order.total_price) !== Number(current.amount)) {
        throw new Error("Order cannot be finalized for this payment");
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
      const updated = await tx.from("payment_intents").update({ status: "success", paid_at: paidAt, raw_payload: detail })
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
    await supabase
      .from("payment_intents")
      .update({
        status: detail.payment_status,
        raw_payload: detail as unknown as Record<string, unknown>,
      })
      .eq("id", intent.id)
      .eq("status", "pending");

    return {
      intent: {
        ...intent,
        status: detail.payment_status as PaymentIntentStatus,
      },
      finalized: false,
    };
  }

  // Masih pending: tandai expired lokal bila lewat waktu.
  if (intent.expired_at && new Date(intent.expired_at).getTime() < Date.now()) {
    await supabase
      .from("payment_intents")
      .update({ status: "expired" })
      .eq("id", intent.id)
      .eq("status", "pending");

    return { intent: { ...intent, status: "expired" }, finalized: false };
  }

  return { intent, finalized: false };
}
