import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, sql } from "@rakku/db";
import { runFinancialCommand } from "@rakku/db/financial-commands";
import { InventoryError, assertOwnerOutlet, inventoryNumber } from "@rakku/db/owner-inventory";
import { recordPurchase, type PurchaseItemInput } from "@rakku/inventory";
import { ownerInventoryScope, inventoryId, inventoryErrorResponse, inventoryPage, requireAdvancedInventory } from "@/lib/inventory-api";

export async function GET(request: NextRequest) {
  try {
    const scope = await ownerInventoryScope(request.nextUrl.searchParams.get("outlet_id"));
    const { page, pageSize, offset } = inventoryPage(request.nextUrl.searchParams);
    const db = createAdminClient();
    const [total] = await db.execute(sql`select count(*)::int as count from public.ingredient_purchases
      where company_id=${scope.companyId} and outlet_id=${scope.outletId}`);
    const purchases = await db.execute(sql`select p.*, coalesce(a.name,u.name,'Sistem') as actor_name
      from public.ingredient_purchases p left join public.owners a on a.id=p.created_by_owner_id
      left join public.users u on u.id=p.created_by where p.company_id=${scope.companyId} and p.outlet_id=${scope.outletId}
      order by p.purchase_date desc,p.id desc limit ${pageSize} offset ${offset}`);
    const items = purchases.length ? await db.execute(sql`select pi.*,i.name as ingredient_name,i.unit
      from public.ingredient_purchase_items pi join public.ingredients i on i.id=pi.ingredient_id
      join public.ingredient_purchases p on p.id=pi.purchase_id
      where pi.purchase_id in (${sql.join(purchases.map(row => sql`${row.id}::uuid`), sql`, `)})
        and p.company_id=${scope.companyId} and p.outlet_id=${scope.outletId} order by i.name`) : [];
    return NextResponse.json({ purchases: purchases.map(row => ({ ...row, total_amount: Number(row.total_amount),
      items: items.filter(item => item.purchase_id === row.id).map(item => ({ ...item, quantity: Number(item.quantity), unit_cost: Number(item.unit_cost), subtotal: Number(item.subtotal) })) })),
      total: Number(total.count), page, pageSize });
  } catch (error) { return inventoryErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) throw new InventoryError("Body tidak valid");
    const scope = await ownerInventoryScope(body.outlet_id);
    const requestId = inventoryId(body.request_id, "Request ID");
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new InventoryError("Isi 1–100 baris pembelian");
    const items: PurchaseItemInput[] = body.items.map((item: Record<string, unknown>) => ({
      ingredient_id: inventoryId(item?.ingredient_id, "Bahan"),
      quantity: inventoryNumber(item?.quantity, "Jumlah pembelian", true), unit_cost: inventoryNumber(item?.unit_cost, "Biaya per satuan"),
    }));
    for (const field of ["supplier", "note"]) if (body[field] !== undefined && (typeof body[field] !== "string" || body[field].length > 1000)) throw new InventoryError("Pemasok/catatan tidak valid");
    if (body.date !== undefined && typeof body.date !== "string") throw new InventoryError("Tanggal tidak valid");
    const values = { supplier: body.supplier, date: body.date, note: body.note, items };
    const result = await runFinancialCommand(createAdminClient(), { companyId: scope.companyId, requestId,
      command: "owner.inventory.purchase", payload: { scope, ...values }, execute: async tx => {
        await assertOwnerOutlet(tx, scope);
        await requireAdvancedInventory(tx, scope.companyId);
        return recordPurchase(tx, { ...scope, userId: null, ...values });
      } });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return inventoryErrorResponse(error); }
}
