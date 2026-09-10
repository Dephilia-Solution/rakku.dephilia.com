import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { processInvoice } from "@/lib/billing/subscription";
import type { SubscriptionInvoice } from "@rakku/shared-types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("subscription_invoices")
    .select("*")
    .eq("id", id)
    .eq("company_id", session.company_id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
  }

  const result = await processInvoice(supabase, data as SubscriptionInvoice);
  return NextResponse.json({ invoice: result.invoice, activated: result.activated });
}
