import { NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { getPublicSignupPromotion, SignupPromotionError } from "@rakku/db/signup-promotions";

export const dynamic = "force-dynamic";
// Public, read-only marketing data. No cookies, owner identities or grant rows.
const headers = {"Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS"};
export async function GET() {
  try {
    const now = new Date();
    return NextResponse.json({promotion: await getPublicSignupPromotion(createAdminClient(), now),serverNow: now.toISOString()}, {headers});
  } catch (error) {
    if (error instanceof SignupPromotionError) return NextResponse.json({error: error.message,code: error.code}, {status: error.status,headers});
    console.error("[public-signup-promotion]", error);
    return NextResponse.json({error: "Informasi promo tidak tersedia"}, {status: 503,headers});
  }
}
export async function OPTIONS() { return new NextResponse(null, {status: 204,headers}); }
