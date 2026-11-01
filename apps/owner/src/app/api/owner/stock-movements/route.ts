import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, sql } from "@rakku/db";
import { InventoryError } from "@rakku/db/owner-inventory";
import { ownerInventoryScope, inventoryId, inventoryErrorResponse, inventoryPage } from "@/lib/inventory-api";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const scope = await ownerInventoryScope(params.get("outlet_id"));
    const { page, pageSize, offset } = inventoryPage(params);
    const ingredientId = params.get("ingredient_id") ? inventoryId(params.get("ingredient_id"), "Bahan") : null;
    const db = createAdminClient();
    if (ingredientId) {
      const [ingredient] = await db.execute(sql`select id from public.ingredients where id=${ingredientId}
        and company_id=${scope.companyId} and outlet_id=${scope.outletId}`);
      if (!ingredient) throw new InventoryError("Bahan tidak ditemukan", 404);
    }
    const filter = sql`m.company_id=${scope.companyId} and m.outlet_id=${scope.outletId}
      ${ingredientId ? sql`and m.ingredient_id=${ingredientId}` : sql``}`;
    const [total] = await db.execute(sql`select count(*)::int as count from public.stock_movements m where ${filter}`);
    const rows = await db.execute(sql`select m.*,i.name as ingredient_name,i.unit,
      coalesce(a.name,u.name,'Sistem') as actor_name from public.stock_movements m
      join public.ingredients i on i.id=m.ingredient_id
      left join public.owners a on a.id=m.created_by_owner_id left join public.users u on u.id=m.created_by
      where ${filter} order by m.created_at desc,m.id desc limit ${pageSize} offset ${offset}`);
    return NextResponse.json({ movements: rows.map(row => ({ ...row, quantity_change: Number(row.quantity_change) })),
      total: Number(total.count), page, pageSize });
  } catch (error) { return inventoryErrorResponse(error); }
}
