import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { processInvoice } from "@/lib/billing/subscription";
import type { SubscriptionInvoice } from "@rakku/shared-types";

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
 * invoice diambil dari DB lalu status di-re-verify ke Vessel lewat
 * processInvoice() sebelum aktivasi (idempotent).
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
  let query = supabase.from("subscription_invoices").select("*").limit(1);
  query = transactionId
    ? query.eq("provider_transaction_id", transactionId)
    : query.eq("invoice_number", invoiceNumber as string);

  const { data: invoice } = await query.maybeSingle();

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
