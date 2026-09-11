import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { checkLimit } from "@rakku/plans";
import { createQrisIntent } from "@rakku/payments";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { CartItem, AppliedDiscount } from "@rakku/shared-types";

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const {
    orderType,
    items,
    subtotal,
    total,
    customerName,
    tableId,
    note,
    taxes,
    discounts,
    pricingTierId,
  } = body ?? {};

  if (!orderType || !items || !items.length) {
    return NextResponse.json({ error: "Data order tidak lengkap" }, { status: 400 });
  }
  if (!customerName || !customerName.trim()) {
    return NextResponse.json({ error: "Nama customer wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const limit = await checkLimit(supabase, session.company_id, "transactions");
  if (!limit.allowed) {
    return NextResponse.json(limit, { status: 403 });
  }

  const discountAmount =
    (discounts as AppliedDiscount[] | undefined)?.reduce(
      (sum, d) => sum + d.amount,
      0
    ) ?? 0;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_type: orderType,
      payment_method: "qris",
      payment_channel: "dynamic_qris",
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      taxes: taxes ?? null,
      discounts: discounts ?? null,
      discount_amount: discountAmount,
      total_price: total,
      customer_name: customerName.trim(),
      table_id: tableId || null,
      note: note || null,
      status: "pending_payment",
      payment_status: "unpaid",
      company_id: session.company_id,
      outlet_id: session.outlet_id,
      cashier_id: session.user_id,
      cashier_name: session.user_name ?? null,
      pricing_tier_id: pricingTierId || null,
      split_bill: false,
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: orderError?.message ?? "Gagal membuat order" },
      { status: 500 }
    );
  }

  const orderItems = items.map((item: CartItem) => ({
    order_id: order.id,
    product_id: item.product.id,
    product_name: item.product.name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    modifier_label: item.modifier_label,
    note: item.note || null,
    subtotal: item.subtotal,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const ownerBase = process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000";
  const result = await createQrisIntent(supabase, {
    companyId: session.company_id,
    outletId: session.outlet_id,
    orderId: order.id,
    amount: Number(total),
    callbackUrl: `${ownerBase}/api/webhooks/vessel`,
    createdBy: session.user_id,
  });

  if ("error" in result) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json(
    { order, intent: result.intent },
    { status: 201 }
  );
}
