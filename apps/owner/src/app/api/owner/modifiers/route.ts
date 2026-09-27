import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import type { OwnerSession } from "@rakku/shared-types";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

export async function GET(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id");

  if (!productId) {
    return NextResponse.json({ error: "product_id wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("modifiers")
    .select("*, modifier_tier_prices(*), products!inner(company_id)")
    .eq("product_id", productId)
    .eq("products.company_id", session.company_id)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ modifiers: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const { product_id, name, group_name, prices } = body ?? {};

  if (!product_id || !name || !String(name).trim()) {
    return NextResponse.json(
      { error: "Product ID dan nama harus diisi" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Pastikan produk milik perusahaan owner
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", String(product_id))
    .eq("company_id", session.company_id)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  const { data: modifier, error: modError } = await supabase
    .from("modifiers")
    .insert({
      product_id: String(product_id),
      name: String(name).trim(),
      price_delta: 0,
      group_name: group_name ? String(group_name) : null,
    })
    .select()
    .single();

  if (modError || !modifier) {
    return NextResponse.json(
      { error: modError?.message ?? "Gagal membuat modifier" },
      { status: 500 }
    );
  }

  if (prices && Array.isArray(prices) && prices.length > 0) {
    const inserts = prices.map((p: { tier_id: string; price_delta: number }) => ({
      modifier_id: modifier.id,
      tier_id: p.tier_id,
      price_delta: Number(p.price_delta) || 0,
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
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const { id, name, group_name, prices } = body ?? {};

  if (!id) {
    return NextResponse.json({ error: "ID modifier harus diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: modifier } = await supabase
    .from("modifiers")
    .select("id, products!inner(company_id)")
    .eq("id", id)
    .maybeSingle();

  const productCompany = (modifier?.products as unknown as { company_id: string } | null)?.company_id;
  if (!modifier || productCompany !== session.company_id) {
    return NextResponse.json({ error: "Modifier tidak ditemukan" }, { status: 404 });
  }

  if (name !== undefined || group_name !== undefined) {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (group_name !== undefined) updates.group_name = group_name ? String(group_name) : null;

    const { error: updateError } = await supabase
      .from("modifiers")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  if (prices && Array.isArray(prices)) {
    await supabase.from("modifier_tier_prices").delete().eq("modifier_id", id);

    if (prices.length > 0) {
      const inserts = prices.map((p: { tier_id: string; price_delta: number }) => ({
        modifier_id: id,
        tier_id: p.tier_id,
        price_delta: Number(p.price_delta) || 0,
      }));

      const { error: tierError } = await supabase
        .from("modifier_tier_prices")
        .insert(inserts);

      if (tierError) {
        console.error("Failed to update modifier tier prices:", tierError.message);
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID modifier wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Pastikan modifier milik produk perusahaan owner
  const { data: modifier } = await supabase
    .from("modifiers")
    .select("id, products!inner(company_id)")
    .eq("id", id)
    .maybeSingle();

  const productCompany = (modifier?.products as unknown as { company_id: string } | null)?.company_id;
  if (!modifier || productCompany !== session.company_id) {
    return NextResponse.json({ error: "Modifier tidak ditemukan" }, { status: 404 });
  }

  const { error } = await supabase.from("modifiers").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
