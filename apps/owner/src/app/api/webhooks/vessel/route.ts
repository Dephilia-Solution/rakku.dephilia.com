import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { processOrderPayment } from "@rakku/payments";
import { processInvoice } from "@/lib/billing/subscription";
import type { PaymentIntent, SubscriptionInvoice } from "@rakku/shared-types";

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

/**
 * Webhook Vessel (callback_url). Payload TIDAK dipercaya langsung:
 * data diambil dari DB lalu status di-re-verify ke Vessel sebelum
 * finalisasi (idempotent). Menangani dua jenis transaksi:
 *   1. Pembayaran pelanggan (payment_intents → order)
 *   2. Tagihan langganan (subscription_invoices)
 */
export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as JsonLike | null;
  if (!payload) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const transactionId =
    pick(payload, "transaction_id") ?? pick(payload, "id");
  const invoiceNumber = pick(payload, "invoice_number");

  if (!transactionId && !invoiceNumber) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const supabase = createAdminClient();

  // 1. Pembayaran pelanggan (QRIS dinamis POS)
  let intentQuery = supabase.from("payment_intents").select("*").limit(1);
  intentQuery = transactionId
    ? intentQuery.eq("provider_transaction_id", transactionId)
    : intentQuery.eq("invoice_number", invoiceNumber as string);

  const { data: intent } = await intentQuery.maybeSingle();

  if (intent) {
    try {
      await processOrderPayment(supabase, intent as PaymentIntent);
    } catch (err) {
      console.error("[webhooks/vessel] gagal memproses order payment:", err);
    }
    return NextResponse.json({ received: true });
  }

  // 2. Tagihan langganan
  let invoiceQuery = supabase.from("subscription_invoices").select("*").limit(1);
  invoiceQuery = transactionId
    ? invoiceQuery.eq("provider_transaction_id", transactionId)
    : invoiceQuery.eq("invoice_number", invoiceNumber as string);

  const { data: invoice } = await invoiceQuery.maybeSingle();

  if (!invoice) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    await processInvoice(supabase, invoice as SubscriptionInvoice);
  } catch (err) {
    console.error("[webhooks/vessel] gagal memproses invoice:", err);
  }

  return NextResponse.json({ received: true });
}
