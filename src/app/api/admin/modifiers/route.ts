import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id");

  const supabase = createAdminClient();
  let query = supabase.from("modifiers").select("*, modifier_tier_prices(*)").order("name");

  if (productId) {
    query = query.eq("product_id", productId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { product_id, name, group_name, prices } = body;

  if (!product_id || !name) {
    return NextResponse.json({ error: "Product ID dan nama harus diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: modifier, error: modError } = await supabase
    .from("modifiers")
    .insert({ product_id, name, price_delta: 0, group_name: group_name || null })
    .select()
    .single();

  if (modError || !modifier) {
    return NextResponse.json({ error: modError?.message ?? "Gagal membuat modifier" }, { status: 500 });
  }

  if (prices && Array.isArray(prices) && prices.length > 0) {
    const inserts = prices.map((p: { tier_id: string; price_delta: number }) => ({
      modifier_id: modifier.id,
      tier_id: p.tier_id,
      price_delta: p.price_delta,
    }));

    const { error: tierError } = await supabase
      .from("modifier_tier_prices")
      .insert(inserts);

    if (tierError) {
      console.error("Failed to insert modifier tier prices:", tierError.message);
    }
  }

  return NextResponse.json(modifier, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID modifier harus diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("modifiers").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
