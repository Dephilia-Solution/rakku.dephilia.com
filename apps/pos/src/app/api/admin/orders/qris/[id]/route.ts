import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { processOrderPayment } from "@rakku/payments";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import type { PaymentIntent } from "@rakku/shared-types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .eq("company_id", session.company_id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  }

  const { data: intent } = await supabase
    .from("payment_intents")
    .select("*")
    .eq("order_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let processedIntent = intent as PaymentIntent | null;
  let finalized = false;

  if (intent) {
    const result = await processOrderPayment(supabase, intent as PaymentIntent);
    processedIntent = result.intent;
    finalized = result.finalized;
  }

  const { data: refreshed } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .maybeSingle();

  return NextResponse.json({
    order: refreshed ?? order,
    intent: processedIntent,
    finalized,
  });
}
