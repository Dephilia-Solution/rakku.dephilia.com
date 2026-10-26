import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, sql } from "@rakku/db";
import { createOwnerIngredient, updateOwnerIngredient, deleteOwnerIngredient, InventoryError } from "@rakku/db/owner-inventory";
import { runFinancialCommand } from "@rakku/db/financial-commands";
import { checkLimit } from "@rakku/plans";
import { ownerInventoryScope, inventoryId, inventoryErrorResponse } from "@/lib/inventory-api";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@rakku/shared-types";
import {
  getCompanyIngredients,
  verifyOutletBelongsToCompany,
} from "@/lib/supabase/queries.data";

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

  if (!outletId) {
    return NextResponse.json({ error: "outlet_id wajib diisi" }, { status: 400 });
  }

  if (!(await verifyOutletBelongsToCompany(String(outletId), session.company_id))) {
    return NextResponse.json({ error: "Outlet tidak valid" }, { status: 400 });
  }

  const ingredients = await getCompanyIngredients(
    session.company_id,
    String(outletId)
  );
  return NextResponse.json(ingredients);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) throw new InventoryError("Body tidak valid");
    const scope = await ownerInventoryScope(body.outlet_id);
    const values = { name: body.name, unit: body.unit, stock_quantity: body.stock_quantity ?? 0,
      min_stock_alert: body.min_stock_alert ?? 0, cost_per_unit: body.cost_per_unit ?? 0 };
    const result = await runFinancialCommand(createAdminClient(), {
      companyId: scope.companyId, requestId: body.request_id == null ? null : inventoryId(body.request_id, "Request ID"),
      command: "owner.ingredient.create", payload: { scope, values },
      execute: db => db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${scope.companyId},0))`);
        if (!(await checkLimit(tx, scope.companyId, "ingredients")).allowed) {
          throw new InventoryError("Kuota bahan baku paket Anda sudah penuh", 403, "PLAN_LIMIT");
        }
        return createOwnerIngredient(tx, scope, values);
      }),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return inventoryErrorResponse(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) throw new InventoryError("Body tidak valid");
    const scope = await ownerInventoryScope(body.outlet_id);
    const ingredient = await updateOwnerIngredient(createAdminClient(), scope, inventoryId(body.id), body);
    return NextResponse.json(ingredient);
  } catch (error) { return inventoryErrorResponse(error); }
}
export async function DELETE(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const scope = await ownerInventoryScope(params.get("outlet_id"));
    return NextResponse.json(await deleteOwnerIngredient(createAdminClient(), scope, inventoryId(params.get("id"))));
  } catch (error) { return inventoryErrorResponse(error); }
}
