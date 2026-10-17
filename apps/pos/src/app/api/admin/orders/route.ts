import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { checkLimit } from "@rakku/plans";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { CartItem, SplitPayment, AppliedDiscount } from "@rakku/shared-types";
import { deductStockForOrder } from "@rakku/inventory";
import { sql } from "@rakku/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    orderType, paymentMethod, items, subtotal, total,
    customerName, tableId, note, status, paymentStatus,
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

  try {
  return await createAdminClient().transaction(async supabase => {
  await supabase.execute(sql`select pg_advisory_xact_lock(hashtextextended(${session.company_id},0))`);

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
      company_id: session.company_id,
      outlet_id: session.outlet_id,
      cashier_id: session.user_id,
      cashier_name: cashierName,
      pricing_tier_id: pricingTierId || null,
      split_bill: (splitPayments?.length ?? 0) > 0,
    })
    .select()
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message ?? "Gagal membuat order");
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
    throw new Error(itemsError.message);
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
      throw new Error(splitError.message);
    }
  }

  // Stock deduction shares the order transaction.
  if ((status || "completed") === "completed") {
    await deductStockForOrder(
      supabase,
      order.id,
      session.company_id,
      session.outlet_id,
      session.user_id ?? null
    );
  }

  // Tandai meja occupied dalam transaksi yang sama untuk order selesai ber-meja.
  // Kasir bisa toggle manual kembali ke available (keputusan M6).
  if ((status || "completed") === "completed" && tableId) {
    const { error: tableError } = await supabase
      .from("dining_tables")
      .update({ status: "occupied" })
      .eq("id", tableId);
    if (tableError) {
      throw new Error(tableError.message);
    }
  }

  return NextResponse.json(order, { status: 201 });
  });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat order" }, { status: 500 });
  }
}
