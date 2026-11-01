import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { replaceProductTierPrices } from "@rakku/db/merchant";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const { productId, prices } = body ?? {};
  if (!productId || !Array.isArray(prices)) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }
  try {
    await replaceProductTierPrices(createAdminClient(), session.company_id, String(productId),
      prices.map((price: { tier_id: string; price: number }) => ({ tier_id: String(price.tier_id), price: Number(price.price) })));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menyimpan harga tier" }, { status: 400 });
  }
}
