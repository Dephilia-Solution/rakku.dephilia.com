import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
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

  try {
    await expirePendingIntents(supabase, id);
    const { data: cancelled, error } = await supabase.from("orders").update({ status: "cancelled" })
      .eq("id", id).eq("company_id", session.company_id).eq("status", "pending_payment").eq("payment_status", "unpaid").select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!cancelled) return NextResponse.json({ error: "Order sudah berubah. Muat ulang order." }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "QRIS belum dapat dibatalkan" }, { status: 409 });
  }
}
