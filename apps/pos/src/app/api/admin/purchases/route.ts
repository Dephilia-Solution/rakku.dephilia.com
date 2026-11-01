import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { checkFeature } from "@rakku/plans";
import { recordPurchase, type PurchaseItemInput } from "@rakku/inventory";
import { runFinancialCommand } from "@rakku/db/financial-commands";
import { getAllPurchases } from "@/lib/supabase/queries.server";

export async function GET() {
  if (!await getTenantSessionFromCookies()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getAllPurchases());
}
export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const items = body.items as PurchaseItemInput[];
  if (!Array.isArray(items) || !items.length || items.some(item => !item.ingredient_id ||
    !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unit_cost) || item.unit_cost < 0)) {
    return NextResponse.json({ error: "Bahan, jumlah, dan harga beli tidak valid" }, { status: 400 });
  }
  const db = createAdminClient();
  const feature = await checkFeature(db, session.company_id, "inventory_advanced");
  if (!feature.allowed) return NextResponse.json(feature, { status: 403 });
  try {
    const requestId = typeof body.requestId === "string" ? body.requestId : request.headers.get("idempotency-key");
    const result = await runFinancialCommand(db, {
      companyId: session.company_id,
      requestId,
      command: "purchase.create",
      payload: body,
      execute: tx => recordPurchase(tx, { companyId: session.company_id, outletId: session.outlet_id,
        userId: session.user_id, supplier: body.supplier_name, date: body.purchase_date, note: body.note, items }),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mencatat pembelian" }, { status });
  }
}
