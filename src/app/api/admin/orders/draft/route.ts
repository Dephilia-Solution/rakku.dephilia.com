import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function GET() {
  const session = await getTenantSessionFromCookies();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { items, customerName, note, companyId, outletId, cashierId, pricingTierId } = body;

  if (!customerName || !customerName.trim()) {
    return NextResponse.json({ error: "Nama customer wajib diisi" }, { status: 400 });
  }

  const session = await getTenantSessionFromCookies();
  const cashierName = session?.user_name ?? null;

  const supabase = createAdminClient();

  const subtotal = items.reduce((sum: number, item: { unit_price: number; quantity: number }) => sum + (item.unit_price * item.quantity), 0);
  const taxRate = Number(process.env.NEXT_PUBLIC_TAX_RATE) || 10;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_type: "dine_in",
      payment_method: "later",
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_price: total,
      customer_name: customerName.trim(),
      note: note || null,
      status: "draft",
      payment_status: "unpaid",
      company_id: companyId || null,
      outlet_id: outletId || null,
      cashier_id: cashierId || null,
      cashier_name: cashierName,
      pricing_tier_id: pricingTierId || null,
      reserved_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h expiry
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Gagal membuat draft" }, { status: 500 });
  }

  const orderItems = items.map((item: { product: { id: string; name: string }; modifier_label?: string | null; unit_price: number; quantity: number; subtotal: number }) => ({
    order_id: order.id,
    product_id: item.product.id,
    product_name: item.product.name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    modifier_label: item.modifier_label || null,
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

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const body = await request.json();
  const { status, payment_status } = body;

  if (!id) {
    return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const updates: Record<string, string> = {};
  if (status) updates.status = status;
  if (payment_status) updates.payment_status = payment_status;

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
