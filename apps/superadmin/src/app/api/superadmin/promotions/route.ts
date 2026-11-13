import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { getSignupPromotionDetail, listSignupPromotions, saveSignupPromotion, SignupPromotionError } from "@rakku/db/signup-promotions";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

export const dynamic = "force-dynamic";
function failure(error: unknown) {
  if (error instanceof SignupPromotionError) return NextResponse.json({error: error.message,code: error.code}, {status: error.status});
  if (error instanceof Error && error.message === "Unauthorized") return NextResponse.json({error: "Unauthorized"}, {status: 401});
  console.error("[signup-promotions]", error);
  return NextResponse.json({error: "Pengaturan promo belum dapat diproses."}, {status: 500});
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperadmin();
    const db = createAdminClient(), id = request.nextUrl.searchParams.get("id");
    if (id) return NextResponse.json(await getSignupPromotionDetail(db, id), {headers: {"Cache-Control": "no-store"}});
    const promotions = await listSignupPromotions(db);
    const {data: plans,error} = await db.from("plans").select("id,name,slug").eq("is_active",true).neq("slug","free").order("sort_order");
    if (error) throw new Error(error.message);
    return NextResponse.json({promotions,plans: plans ?? []}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return failure(error); }
}

async function save(request: NextRequest, update: boolean) {
  try {
    const actor = await requireSuperadmin();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({error: "Data promo tidak valid"}, {status: 400});
    if (update && typeof body.id !== "string") return NextResponse.json({error: "ID promo wajib diisi"}, {status: 400});
    const promotion = await saveSignupPromotion(createAdminClient(), body, actor.id, update ? body.id : undefined, body.expectedRevision);
    return NextResponse.json({promotion}, {status: update ? 200 : 201});
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) { return save(request, false); }
export async function PUT(request: NextRequest) { return save(request, true); }
