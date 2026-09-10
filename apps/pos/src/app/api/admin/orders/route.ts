import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { checkLimit } from "@rakku/plans";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { CartItem, SplitPayment, AppliedDiscount } from "@rakku/shared-types";
import { deductStockForOrder } from "@/lib/inventory/stock";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    orderType, paymentMethod, items, subtotal, total,
    customerName, tableId, note, status, paymentStatus, companyId, outletId, cashierId,
    pricingTierId, splitPayments, taxes, discounts,
  } = body;

  if (!orderType || !paymentMethod || !items || !items.length) {
    return NextResponse.json({ error: "Data order tidak lengkap" }, { status: 400 });
  }

  if (!customerName || !customerName.trim()) {
    return NextResponse.json({ error: "Nama customer wajib diisi" }, { status: 400 });
  }

  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cashierName = session.user_name ?? null;

  const supabase = createAdminClient();

  if ((status || "completed") === "completed") {
    const limit = await checkLimit(supabase, session.company_id, "transactions");
    if (!limit.allowed) {
      return NextResponse.json(limit, { status: 403 });
    }
  }

  const discountAmount = (discounts as AppliedDiscount[] | undefined)?.reduce((sum, d) => sum + d.amount, 0) ?? 0;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_type: orderType,
      payment_method: paymentMethod,
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

  // Potong stok otomatis (best-effort) — hanya untuk order selesai.
  // Gagal di sini tidak menggagalkan order; error di-log (keputusan M2).
  if ((status || "completed") === "completed") {
    await deductStockForOrder(order.id, companyId, outletId);
  }

  // Tandai meja occupied (best-effort) — hanya untuk order selesai ber-meja.
  // Kasir bisa toggle manual kembali ke available (keputusan M6).
  if ((status || "completed") === "completed" && tableId) {
    const { error: tableError } = await supabase
      .from("dining_tables")
      .update({ status: "occupied" })
      .eq("id", tableId);
    if (tableError) {
      console.error("Failed to mark table occupied:", tableError);
    }
  }

  return NextResponse.json(order, { status: 201 });
}
