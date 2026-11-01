import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { replaceModifierTierPrices } from "@rakku/db/merchant";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

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

export async function PATCH(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const { id, name, group_name, prices } = body ?? {};

  if (!id) {
    return NextResponse.json({ error: "ID modifier harus diisi" }, { status: 400 });
  }
  if (prices !== undefined && !Array.isArray(prices)) {
    return NextResponse.json({ error: "Harga tier tidak valid" }, { status: 400 });
  }

  const supabase = createAdminClient();
  try {
    await supabase.transaction(async tx => {
      if (name !== undefined || group_name !== undefined) {
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = String(name).trim();
        if (group_name !== undefined) updates.group_name = group_name || null;
        const update = await tx.from("modifiers").update(updates).eq("id", id);
        if (update.error) throw new Error(update.error.message);
      }
      if (Array.isArray(prices)) {
        await replaceModifierTierPrices(tx, session.company_id, String(id),
          prices.map((p: { tier_id: string; price_delta: number }) => ({ tier_id: String(p.tier_id), price_delta: Number(p.price_delta) })));
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengubah modifier" }, { status: 400 });
  }
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
