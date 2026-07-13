import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { syncProductTierPrices } from "@rakku/pricing";

export async function GET() {
  const { getAllProducts } = await import("@/lib/supabase/queries.server");
  const products = await getAllProducts();
  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, price, category_id, description, is_active, company_id, outlet_id } = body;

  if (!name || !price || !category_id) {
    return NextResponse.json({ error: "Nama, harga, dan kategori harus diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name,
      price,
      category_id,
      description: description ?? null,
      is_active: is_active ?? true,
      company_id: company_id || null,
      outlet_id: outlet_id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-seed product_tier_prices for all active tiers in this outlet
  if (company_id && outlet_id) {
    await syncProductTierPrices(supabase, data.id, company_id, outlet_id, price).catch((err) =>
      console.error("syncProductTierPrices failed:", err.message)
    );
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "ID produk harus diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const updateData = { ...updates, updated_at: new Date().toISOString() };

  const { error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID produk harus diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, is_active } = body;

  if (!id) {
    return NextResponse.json({ error: "ID produk harus diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
