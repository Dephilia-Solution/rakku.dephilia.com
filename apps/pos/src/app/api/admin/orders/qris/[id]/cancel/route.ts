import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { expirePendingIntents } from "@rakku/payments";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function POST(
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
    .select("id, status")
    .eq("id", id)
    .eq("company_id", session.company_id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  }

  if (order.status === "pending_payment") {
    await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("company_id", session.company_id);
  }

  await expirePendingIntents(supabase, id);

  return NextResponse.json({ success: true });
}
