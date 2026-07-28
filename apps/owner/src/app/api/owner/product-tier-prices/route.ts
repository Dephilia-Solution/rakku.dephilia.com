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
  const outletId = searchParams.get("outlet_id");
  const productId = searchParams.get("product_id");

  const supabase = createAdminClient();

  if (productId) {
    const { data, error } = await supabase
      .from("product_tier_prices")
      .select("*")
      .eq("product_id", productId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ prices: data ?? [] });
  }

  if (!outletId) {
    return NextResponse.json({ error: "outlet_id wajib diisi" }, { status: 400 });
  }

  const { data: tiers } = await supabase
    .from("pricing_tiers")
    .select("id")
    .eq("company_id", session.company_id)
    .eq("outlet_id", outletId);

  const tierIds = (tiers ?? []).map((t) => t.id as string);
  if (tierIds.length === 0) {
    return NextResponse.json({ prices: [] });
  }

  const { data, error } = await supabase
    .from("product_tier_prices")
    .select("*")
    .in("tier_id", tierIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prices: data ?? [] });
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
  const { productId, prices } = body ?? {};

  if (!productId || !Array.isArray(prices)) {
    return NextResponse.json(
      { error: "productId dan prices wajib diisi" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Pastikan produk milik perusahaan owner
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", String(productId))
    .eq("company_id", session.company_id)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  // Hapus harga tier lama, lalu insert yang baru (replace-all)
  await supabase
    .from("product_tier_prices")
    .delete()
    .eq("product_id", String(productId));

  if (prices.length > 0) {
    const inserts = prices.map((p: { tier_id: string; price: number }) => ({
      product_id: String(productId),
      tier_id: p.tier_id,
      price: Number(p.price) || 0,
    }));

    const { error } = await supabase
      .from("product_tier_prices")
      .insert(inserts);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
