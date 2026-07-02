import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { modifierId, prices } = body;

  if (!modifierId || !prices || !Array.isArray(prices)) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error: deleteError } = await supabase
    .from("modifier_tier_prices")
    .delete()
    .eq("modifier_id", modifierId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (prices.length > 0) {
    const inserts = prices.map((p: { tier_id: string; price_delta: number }) => ({
      modifier_id: modifierId,
      tier_id: p.tier_id,
      price_delta: p.price_delta,
    }));

    const { data, error: insertError } = await supabase
      .from("modifier_tier_prices")
      .insert(inserts)
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
