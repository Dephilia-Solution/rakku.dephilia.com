import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CartItem } from "@/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    orderType, paymentMethod, items, subtotal, taxAmount, total,
    customerName, note, companyId, outletId, cashierId,
  } = body;

  if (!orderType || !paymentMethod || !items || !items.length) {
    return NextResponse.json({ error: "Data order tidak lengkap" }, { status: 400 });
  }

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
      customer_name: customerName || null,
      note: note || null,
      company_id: companyId || null,
      outlet_id: outletId || null,
      cashier_id: cashierId || null,
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
    unit_price: item.product.price,
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

  return NextResponse.json(order, { status: 201 });
}
