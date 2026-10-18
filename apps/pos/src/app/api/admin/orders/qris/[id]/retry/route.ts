import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { createAdminClient as createPlatformClient } from "@rakku/db";
import { createQrisIntent, expirePendingIntents } from "@rakku/payments";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { isCheckoutPaused } from "@rakku/db/runtime-flags";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (await isCheckoutPaused(createPlatformClient())) {
    return NextResponse.json({ error: "Checkout sedang dijeda sementara oleh operator.", code: "CHECKOUT_PAUSED" }, { status: 503 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, total_price, status")
    .eq("id", id)
    .eq("company_id", session.company_id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  }

  if (order.status !== "pending_payment") {
    return NextResponse.json(
      { error: "Order tidak dalam status menunggu pembayaran" },
      { status: 400 }
    );
  }

  try { await expirePendingIntents(supabase, id); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "QRIS belum dapat diulang" }, { status: 409 }); }

  const ownerBase = process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000";
  const result = await createQrisIntent(supabase, {
    companyId: session.company_id,
    outletId: session.outlet_id,
    orderId: id,
    amount: Number(order.total_price),
    callbackUrl: `${ownerBase}/api/webhooks/vessel`,
    createdBy: session.user_id,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ intent: result.intent }, { status: 201 });
}
