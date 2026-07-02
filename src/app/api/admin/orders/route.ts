import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { CartItem, SplitPayment } from "@/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    orderType, paymentMethod, items, subtotal, taxAmount, total,
    customerName, note, status, paymentStatus, companyId, outletId, cashierId,
    pricingTierId, splitPayments,
  } = body;

  if (!orderType || !paymentMethod || !items || !items.length) {
    return NextResponse.json({ error: "Data order tidak lengkap" }, { status: 400 });
  }

  if (!customerName || !customerName.trim()) {
    return NextResponse.json({ error: "Nama customer wajib diisi" }, { status: 400 });
  }

  const session = await getTenantSessionFromCookies();
  const cashierName = session?.user_name ?? null;

  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_type: orderType,
      payment_method: paymentMethod,
      subtotal,
      tax_rate: Number(process.env.NEXT_PUBLIC_TAX_RATE) || 10,
      tax_amount: taxAmount,
      total_price: total,
      customer_name: customerName.trim(),
      note: note || null,
      status: status || "completed",
      payment_status: paymentStatus || "paid",
      company_id: companyId || null,
      outlet_id: outletId || null,
      cashier_id: cashierId || null,
      cashier_name: cashierName,
      pricing_tier_id: pricingTierId || null,
      split_bill: (splitPayments?.length ?? 0) > 0,
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Gagal membuat order" }, { status: 500 });
  }

  const orderItems = items.map((item: CartItem) => ({
    order_id: order.id,
    product_id: item.product.id,
    product_name: item.product.name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    modifier_label: item.modifier_label,
    subtotal: item.subtotal,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Insert split payments if any
  if (splitPayments?.length > 0) {
    const splitInserts = splitPayments.map((sp: SplitPayment) => ({
      order_id: order.id,
      amount: sp.amount,
      payment_method: sp.payment_method,
      status: "paid",
      customer_name: sp.customer_name || null,
      items: sp.items || [],
    }));

    const { error: splitError } = await supabase
      .from("split_payments")
      .insert(splitInserts);

    if (splitError) {
      // Log error but don't fail the order
      console.error("Failed to insert split payments:", splitError);
    }
  }

  return NextResponse.json(order, { status: 201 });
}
