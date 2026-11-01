import { quoteOrder, CheckoutError } from "@rakku/pricing/quote";
import { validateSplits } from "@rakku/db/merchant";
import { checkoutIdentity, findCheckout } from "@rakku/db/checkout";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { createAdminClient as createPlatformClient } from "@rakku/db";
import { checkLimit } from "@rakku/plans";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { isCheckoutPaused } from "@rakku/db/runtime-flags";
import { SplitPayment } from "@rakku/shared-types";
import { deductStockForOrder } from "@rakku/inventory";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    orderType, paymentMethod,
    customerName, tableId, note,
    pricingTierId, splitPayments,
  } = body;

  if (!orderType || !paymentMethod || !body.items?.length || !["cash", "card", "qris"].includes(paymentMethod)) {
    return NextResponse.json({ error: "Data order tidak lengkap" }, { status: 400 });
  }

  if (typeof customerName !== "string" || !customerName.trim()) {
    return NextResponse.json({ error: "Nama customer wajib diisi" }, { status: 400 });
  }

  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (await isCheckoutPaused(createPlatformClient())) {
    return NextResponse.json({ error: "Checkout sedang dijeda sementara oleh operator.", code: "CHECKOUT_PAUSED" }, { status: 503 });
  }
  const cashierName = session.user_name ?? null;

  try {
  return await createAdminClient().transaction(async supabase => {
  const identity = checkoutIdentity(body.requestId, body);
  const prior = await findCheckout(supabase, session, identity);
  if (prior) return NextResponse.json(prior);
  const quote = await quoteOrder(supabase, session, { items: body.items, pricingTierId, tableId });
  if (Number(body.total) !== quote.total) throw new CheckoutError("Harga berubah. Muat ulang katalog sebelum membayar.");
  const { items, subtotal, total, appliedTaxes: taxes, appliedDiscounts: discounts } = quote;
  validateSplits(splitPayments, total);
  if (paymentMethod === "cash" && !splitPayments?.length && (!Number.isFinite(body.amountPaid) || body.amountPaid < total)) throw new CheckoutError("Nominal tunai kurang dari total tagihan");
  const status = "completed";

  if ((status || "completed") === "completed") {
    const limit = await checkLimit(supabase, session.company_id, "transactions");
    if (!limit.allowed) {
      return NextResponse.json(limit, { status: 403 });
    }
  }

  const discountAmount = quote.discountAmount;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      ...identity,
      rounding_amount: quote.roundingAmount,
      order_type: orderType,
      payment_method: paymentMethod,
      subtotal,
      tax_rate: 0,
      tax_amount: quote.totalTaxAmount,
      taxes: taxes ?? null,
      discounts: discounts ?? null,
      discount_amount: discountAmount,
      total_price: total,
      customer_name: customerName.trim(),
      table_id: tableId || null,
      note: note || null,
      status: status || "completed",
      payment_status: "paid",
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

  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product.id,
    product_name: item.product.name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    modifier_label: item.modifier_label,
    modifier_ids: item.modifier_ids,
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat order" }, { status: Number((error as { status?: number }).status) || 500 });
  }
}
