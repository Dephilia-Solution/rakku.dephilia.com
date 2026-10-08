import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { checkLimit } from "@rakku/plans";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { deductStockForOrder } from "@rakku/inventory";
import { sql } from "@rakku/db";

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
  const { items, customerName, note, tableId, pricingTierId } = body;

  if (!customerName || !customerName.trim()) {
    return NextResponse.json({ error: "Nama customer wajib diisi" }, { status: 400 });
  }

  const session = await getTenantSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!Array.isArray(items) || !items.length) return NextResponse.json({ error: "Items wajib diisi" }, { status: 400 });
  const cashierName = session.user_name ?? null;

  try {
  return await createAdminClient().transaction(async supabase => {

  const subtotal = items.reduce((sum: number, item: { unit_price: number; quantity: number }) => sum + (item.unit_price * item.quantity), 0);
  const total = subtotal;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_type: "dine_in",
      payment_method: "later",
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      taxes: null,
      discounts: null,
      discount_amount: 0,
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

  const orderItems = items.map((item: { product: { id: string; name: string }; modifier_label?: string | null; note?: string | null; unit_price: number; quantity: number; subtotal: number }) => ({
    order_id: order.id,
    product_id: item.product.id,
    product_name: item.product.name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    modifier_label: item.modifier_label || null,
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat draft" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const body = await request.json();
  const {
    status,
    payment_status,
    payment_method,
    cashier_name,
    pricing_tier_id,
    table_id,
    subtotal,
    tax_rate,
    tax_amount,
    taxes,
    discounts,
    total_price,
    order_type,
    items,
  } = body;

  if (!id) {
    return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  }

  try {
  return await createAdminClient().transaction(async supabase => {
  await supabase.execute(sql`select pg_advisory_xact_lock(hashtextextended(${session.company_id},0))`);
  const locked = await supabase.execute(sql`select * from public.orders where id=${id} for update`);
  if (!locked[0]) return NextResponse.json({ error: "Draft tidak ditemukan" }, { status: 404 });
  if (locked[0].status === "completed") return NextResponse.json(locked[0]);
  if (locked[0].status !== "draft") return NextResponse.json({ error: "Order bukan draft" }, { status: 400 });
  if (status === "completed") {
    const { data: existing } = await supabase
      .from("orders")
      .select("company_id, status")
      .eq("id", id)
      .maybeSingle();

    if (existing && existing.status !== "completed") {
      const limit = await checkLimit(
        supabase,
        existing.company_id as string,
        "transactions"
      );
      if (!limit.allowed) {
        return NextResponse.json(limit, { status: 403 });
      }
    }
  }

  const orderUpdates: Record<string, unknown> = {};
  if (status) orderUpdates.status = status;
  if (payment_status) orderUpdates.payment_status = payment_status;
  if (payment_method) orderUpdates.payment_method = payment_method;
  if (cashier_name) orderUpdates.cashier_name = cashier_name;
  if (pricing_tier_id !== undefined) orderUpdates.pricing_tier_id = pricing_tier_id;
  if (subtotal !== undefined) orderUpdates.subtotal = subtotal;
  if (tax_rate !== undefined) orderUpdates.tax_rate = tax_rate;
  if (tax_amount !== undefined) orderUpdates.tax_amount = tax_amount;
  if (taxes !== undefined) orderUpdates.taxes = taxes;
  if (discounts !== undefined) orderUpdates.discounts = discounts;
  if (total_price !== undefined) orderUpdates.total_price = total_price;
  if (order_type) orderUpdates.order_type = order_type;
  if (table_id !== undefined) orderUpdates.table_id = table_id;

  const { data, error } = await supabase
    .from("orders")
    .update(orderUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (items && Array.isArray(items)) {
    const deleted = await supabase.from("order_items").delete().eq("order_id", id);
    if (deleted.error) throw new Error(deleted.error.message);

    if (items.length > 0) {
      const orderItems = items.map(
        (item: {
          product_id: string;
          product_name: string;
          unit_price: number;
          quantity: number;
          modifier_label: string | null;
          note: string | null;
          subtotal: number;
        }) => ({
          order_id: id,
          product_id: item.product_id,
          product_name: item.product_name,
          unit_price: item.unit_price,
          quantity: item.quantity,
          modifier_label: item.modifier_label,
          note: item.note,
          subtotal: item.subtotal,
        })
      );

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        throw new Error(itemsError.message);
      }
    }
  }

  // Deduksi stok memakai item terbaru dan berada dalam transaksi completion.
  if (status === "completed") {
    await deductStockForOrder(
      supabase,
      id,
      (data?.company_id as string | null) ?? null,
      (data?.outlet_id as string | null) ?? null
    );

    // Tandai meja occupied dalam transaksi yang sama.
    const resolvedTableId = table_id ?? data?.table_id ?? null;
    if (resolvedTableId) {
      const tableResult = await supabase
        .from("dining_tables")
        .update({ status: "occupied" })
        .eq("id", resolvedTableId);
      if (tableResult.error) throw new Error(tableResult.error.message);
    }
  }

  return NextResponse.json(data);
  });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memperbarui draft" }, { status: 500 });
  }
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
