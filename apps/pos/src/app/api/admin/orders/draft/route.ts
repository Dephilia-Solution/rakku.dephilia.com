import { quoteOrder, CheckoutError } from "@rakku/pricing/quote";
import { checkoutIdentity, findCheckout } from "@rakku/db/checkout";
import { checked, validateSplits } from "@rakku/db/merchant";
import { deleteDraft } from "@rakku/db/merchant";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { createAdminClient as createPlatformClient } from "@rakku/db";
import { checkLimit } from "@rakku/plans";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { requireSessionCapability } from "@/lib/auth/authorize";
import { isCheckoutPaused } from "@rakku/db/runtime-flags";
import { deductStockForOrder } from "@rakku/inventory";
import { sql } from "@rakku/db";
import type { SplitPayment } from "@rakku/shared-types";

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
  const { customerName, note, tableId, pricingTierId } = body;

  if (typeof customerName !== "string" || !customerName.trim()) {
    return NextResponse.json({ error: "Nama customer wajib diisi" }, { status: 400 });
  }

  const session = await getTenantSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!Array.isArray(body.items) || !body.items.length) return NextResponse.json({ error: "Items wajib diisi" }, { status: 400 });
  const cashierName = session.user_name ?? null;

  try {
  return await createAdminClient().transaction(async supabase => {

  const identity = checkoutIdentity(body.requestId, body);
  const prior = await findCheckout(supabase, session, identity);
  if (prior) return NextResponse.json(prior);
  const quote = await quoteOrder(supabase, session, { items: body.items, pricingTierId, tableId });
  const { items, subtotal, total } = quote;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      ...identity,
      rounding_amount: quote.roundingAmount,
      order_type: body.orderType || "dine_in",
      payment_method: "later",
      subtotal,
      tax_rate: 0,
      tax_amount: quote.totalTaxAmount,
      taxes: quote.appliedTaxes,
      discounts: quote.appliedDiscounts,
      discount_amount: quote.discountAmount,
      total_price: total,
      customer_name: customerName.trim(),
      table_id: tableId || null,
      note: note || null,
      status: "draft",
      payment_status: "unpaid",
      company_id: session.company_id,
      outlet_id: session.outlet_id,
      cashier_id: session.user_id,
      cashier_name: cashierName,
      pricing_tier_id: pricingTierId || null,
      reserved_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h expiry
    })
    .select()
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message ?? "Gagal membuat draft");
  }

  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product.id,
    product_name: item.product.name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    modifier_label: item.modifier_label || null,
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

  return NextResponse.json(order, { status: 201 });
  });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat draft" }, { status: Number((error as { status?: number }).status) || 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  const body = await request.json().catch(() => null);
  if (!id || !body || !["draft", "completed"].includes(body.status)) return NextResponse.json({ error: "Draft tidak valid" }, { status: 400 });
  try {
    if (body.status === "completed") {
      await requireSessionCapability(session, "register", "can_create");
      if (await isCheckoutPaused(createPlatformClient())) {
        return NextResponse.json({ error: "Checkout sedang dijeda sementara oleh operator.", code: "CHECKOUT_PAUSED" }, { status: 503 });
      }
    }
    return await createAdminClient().transaction(async supabase => {
      await supabase.execute(sql`select pg_advisory_xact_lock(hashtextextended(${session.company_id},0))`);
      const [order] = await supabase.execute(sql`select * from public.orders where id=${id} and company_id=${session.company_id} and outlet_id=${session.outlet_id} for update`);
      if (!order) return NextResponse.json({ error: "Draft tidak ditemukan" }, { status: 404 });
      if (order.status === "completed") return NextResponse.json(order);
      if (order.status !== "draft") throw new CheckoutError("Order bukan draft");
      if (body.status === "completed" && !["cash", "card", "qris"].includes(body.payment_method)) throw new CheckoutError("Metode bayar tidak valid");
      const quote = await quoteOrder(supabase, session, { items: body.items, pricingTierId: body.pricing_tier_id ?? order.pricing_tier_id, tableId: body.table_id ?? order.table_id });
      if (body.status === "completed" && Number(body.total_price) !== quote.total) throw new CheckoutError("Harga berubah. Muat ulang katalog sebelum membayar.");
      validateSplits(body.split_payments, quote.total);
      if (body.status === "completed" && body.payment_method === "cash" && !body.split_payments?.length
        && (!Number.isFinite(body.amount_paid) || body.amount_paid < quote.total)) throw new CheckoutError("Nominal tunai kurang dari total tagihan");
      if (body.status === "completed") {
        const limit = await checkLimit(supabase, session.company_id, "transactions");
        if (!limit.allowed) return NextResponse.json(limit, { status: 403 });
      }
      checked(await supabase.from("order_items").delete().eq("order_id", id));
      checked(await supabase.from("order_items").insert(quote.items.map(item => ({ order_id: id, product_id: item.product.id,
        product_name: item.product.name, unit_price: item.unit_price, quantity: item.quantity, subtotal: item.subtotal,
        modifier_label: item.modifier_label, modifier_ids: item.modifier_ids, note: item.note }))));
      const data = checked(await supabase.from("orders").update({ status: body.status,
        payment_status: body.status === "completed" ? "paid" : "unpaid",
        payment_method: body.status === "completed" ? body.payment_method : "later",
        cashier_id: session.user_id, cashier_name: session.user_name,
        pricing_tier_id: body.pricing_tier_id ?? order.pricing_tier_id,
        table_id: body.table_id === undefined ? order.table_id : body.table_id,
        order_type: body.order_type ?? order.order_type,
        customer_name: typeof body.customer_name === "string" ? body.customer_name.trim() : order.customer_name,
        note: typeof body.note === "string" ? body.note.slice(0, 1000) : order.note,
        subtotal: quote.subtotal, total_price: quote.total, tax_rate: 0, tax_amount: quote.totalTaxAmount,
        discount_amount: quote.discountAmount, taxes: quote.appliedTaxes, discounts: quote.appliedDiscounts,
        rounding_amount: quote.roundingAmount, split_bill: !!body.split_payments?.length,
      }).eq("id", id).select().single());
      if (body.split_payments?.length) checked(await supabase.from("split_payments").insert(body.split_payments.map((split: SplitPayment) => ({
        order_id: id, amount: split.amount, payment_method: split.payment_method, status: "paid", customer_name: split.customer_name ?? null, items: split.items ?? [],
      }))));
      if (body.status === "completed") {
        await deductStockForOrder(supabase, id, session.company_id, session.outlet_id, session.user_id);
        if (data.table_id) {
          const table = await supabase.from("dining_tables").update({ status: "occupied" }).eq("id", data.table_id);
          if (table.error) throw new Error(table.error.message);
        }
      }
      return NextResponse.json(data);
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memperbarui draft" }, { status: Number((error as { status?: number }).status) || 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  }

  const session = await getTenantSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const removed = await deleteDraft(createAdminClient(), session.company_id, session.outlet_id, id);
  if (!removed) return NextResponse.json({ error: "Draft tidak ditemukan atau sudah dibayar" }, { status: 409 });
  return NextResponse.json({ success: true });
}
