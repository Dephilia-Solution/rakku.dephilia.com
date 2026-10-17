import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { checkFeature } from "@rakku/plans";
import { adjustStock } from "@rakku/inventory";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getTenantSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (!Number.isFinite(body.stock_quantity) || body.stock_quantity < 0) {
    return NextResponse.json({ error: "Stok wajib berupa angka nonnegatif" }, { status: 400 });
  }
  const db = createAdminClient();
  const feature = await checkFeature(db, session.company_id, "inventory_advanced");
  if (!feature.allowed) return NextResponse.json(feature, { status: 403 });
  try {
    return NextResponse.json(await adjustStock(db, { companyId: session.company_id, outletId: session.outlet_id,
      ingredientId: params.id, userId: session.user_id, quantity: body.stock_quantity, note: body.note }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memperbarui stok" }, { status: 400 });
  }
}
