import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { productId, prices } = body;

  if (!productId || !prices || !Array.isArray(prices)) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Delete existing tier prices for this product
  const { error: deleteError } = await supabase
    .from("product_tier_prices")
    .delete()
    .eq("product_id", productId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Insert new tier prices
  if (prices.length > 0) {
    const inserts = prices.map((p: { tier_id: string; price: number }) => ({
      product_id: productId,
      tier_id: p.tier_id,
      price: p.price,
    }));

    const { data, error: insertError } = await supabase
      .from("product_tier_prices")
      .insert(inserts)
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
