import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { replaceModifierTierPrices } from "@rakku/db/merchant";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const { modifierId, prices } = body ?? {};
  if (!modifierId || !Array.isArray(prices)) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }
  try {
    await replaceModifierTierPrices(createAdminClient(), session.company_id, String(modifierId),
      prices.map((price: { tier_id: string; price_delta: number }) => ({ tier_id: String(price.tier_id), price_delta: Number(price.price_delta) })));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menyimpan harga tier modifier" }, { status: 400 });
  }
}
