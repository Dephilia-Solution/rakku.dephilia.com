import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { processInvoice } from "@/lib/billing/subscription";
import type { SubscriptionInvoice } from "@rakku/shared-types";

async function getScopedInvoice(invoiceId: string) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return { error: "forbidden" as const };

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("subscription_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("company_id", session.company_id)
    .maybeSingle();

  if (!data) return { error: "not_found" as const };
  return { supabase, invoice: data as SubscriptionInvoice };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scoped = await getScopedInvoice(id);

  if (scoped.error === "forbidden") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (scoped.error === "not_found") {
    return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
  }

  const result = await processInvoice(scoped.supabase, scoped.invoice);
  return NextResponse.json({ invoice: result.invoice, activated: result.activated });
}
