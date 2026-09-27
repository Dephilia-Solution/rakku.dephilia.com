import type { SupabaseClient } from "@supabase/supabase-js";
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
  intent: PaymentIntent,
  statusFetcher: (
    transactionId: string
  ) => Promise<VesselPaymentDetail> = getPaymentStatus
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
    // Atomic claim: hanya satu proses yang boleh finalisasi.
    const { data: claimed } = await supabase
      .from("payment_intents")
      .update({
        status: "success",
        paid_at: detail.paid_at ?? new Date().toISOString(),
        raw_payload: detail as unknown as Record<string, unknown>,
      })
      .eq("id", intent.id)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (!claimed) {
      return {
        intent: { ...intent, status: "success", paid_at: detail.paid_at },
        finalized: false,
      };
    }

    const { data: order } = await supabase
      .from("orders")
      .select("id, company_id, outlet_id, table_id, status")
      .eq("id", intent.order_id)
      .maybeSingle();

    if (order) {
      await supabase
        .from("orders")
        .update({ status: "completed", payment_status: "paid" })
        .eq("id", order.id)
        .eq("status", "pending_payment");

      await deductStockForOrder(
        supabase,
        order.id as string,
        order.company_id as string | null,
        order.outlet_id as string | null,
        intent.created_by
      );

      if (order.table_id) {
        await supabase
          .from("dining_tables")
          .update({ status: "occupied" })
          .eq("id", order.table_id as string);
      }

      await creditBalance(supabase, {
        companyId: intent.company_id,
        outletId: intent.outlet_id,
        grossAmount: Number(intent.amount),
        referenceType: "payment_intent",
        referenceId: intent.id,
        note: `Pembayaran QRIS order ${order.id}`,
        createdBy: "system",
      });
    }

    return {
      intent: {
        ...intent,
        status: "success",
        paid_at: detail.paid_at ?? new Date().toISOString(),
      },
      finalized: true,
    };
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
