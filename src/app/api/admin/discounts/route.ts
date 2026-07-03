import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function GET(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "product" or "order" or null (both)

  const supabase = createAdminClient();

  if (type === "product") {
    const { data, error } = await supabase
      .from("product_discounts")
      .select("*")
      .eq("company_id", session.company_id)
      .eq("outlet_id", session.outlet_id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  }

  if (type === "order") {
    const { data, error } = await supabase
      .from("order_discounts")
      .select("*")
      .eq("company_id", session.company_id)
      .eq("outlet_id", session.outlet_id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  }

  // Fetch both when no type specified
  const [productResult, orderResult] = await Promise.all([
    supabase
      .from("product_discounts")
      .select("*")
      .eq("company_id", session.company_id)
      .eq("outlet_id", session.outlet_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_discounts")
      .select("*")
      .eq("company_id", session.company_id)
      .eq("outlet_id", session.outlet_id)
      .order("created_at", { ascending: false }),
  ]);

  if (productResult.error) {
    return NextResponse.json({ error: productResult.error.message }, { status: 500 });
  }

  if (orderResult.error) {
    return NextResponse.json({ error: orderResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    productDiscounts: productResult.data ?? [],
    orderDiscounts: orderResult.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { scope, product_id, name, type, value, start_date, end_date } = body;

  if (!scope || !name || !type || value === undefined || !start_date || !end_date) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }

  if (!["percentage", "fixed"].includes(type)) {
    return NextResponse.json({ error: "Tipe harus percentage atau fixed" }, { status: 400 });
  }

  if (scope === "product" && !product_id) {
    return NextResponse.json({ error: "product_id wajib untuk diskon produk" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (scope === "product") {
    const { data, error } = await supabase
      .from("product_discounts")
      .insert({
        company_id: session.company_id,
        outlet_id: session.outlet_id,
        product_id,
        name,
        type,
        value,
        start_date,
        end_date,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }

  if (scope === "order") {
    const { data, error } = await supabase
      .from("order_discounts")
      .insert({
        company_id: session.company_id,
        outlet_id: session.outlet_id,
        name,
        type,
        value,
        start_date,
        end_date,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json({ error: "Scope harus product atau order" }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, scope, product_id, name, type, value, start_date, end_date, is_active } = body;

  if (!id || !scope) {
    return NextResponse.json({ error: "ID dan scope wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (value !== undefined) updates.value = value;
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (is_active !== undefined) updates.is_active = is_active;
  if (product_id !== undefined) updates.product_id = product_id;

  const table = scope === "product" ? "product_discounts" : "order_discounts";

  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq("id", id)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const scope = searchParams.get("scope");

  if (!id || !scope) {
    return NextResponse.json({ error: "ID dan scope wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const table = scope === "product" ? "product_discounts" : "order_discounts";

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
