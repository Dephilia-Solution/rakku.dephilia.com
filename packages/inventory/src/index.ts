import { sql, type DatabaseClient } from "@rakku/db";

/** Atomic, idempotent deduction: stock and movement commit together. */
export async function deductStockForOrder(
  db: DatabaseClient, orderId: string, companyId: string | null,
  outletId: string | null, createdBy: string | null = null
): Promise<void> {
  if (!companyId || !outletId) throw new Error("Missing order company/outlet scope");
  const result = await db.rpc("deduct_stock_for_order", {
    p_order_id: orderId, p_company_id: companyId, p_outlet_id: outletId, p_created_by: createdBy,
  });
  if (result.error) throw new Error(result.error.message);
}

export interface PurchaseItemInput { ingredient_id: string; quantity: number; unit_cost: number; }
export async function recordPurchase(db: DatabaseClient, input: {
  companyId: string; outletId: string; userId: string; supplier?: string; date?: string; note?: string;
  items: PurchaseItemInput[];
}) {
  return db.transaction(async tx => {
    const ids = Array.from(new Set(input.items.map(item => item.ingredient_id)));
    const locked = await tx.execute(sql`select id from public.ingredients where company_id=${input.companyId}
      and outlet_id=${input.outletId} and id in (${sql.join(ids.map(id => sql`${id}::uuid`), sql`, `)}) order by id for update`);
    if (locked.length !== ids.length) throw new Error("Bahan tidak ditemukan pada outlet ini");
    const total = input.items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
    const result = await tx.from("ingredient_purchases").insert({ company_id: input.companyId, outlet_id: input.outletId,
      supplier_name: input.supplier?.trim() || null, purchase_date: input.date ?? new Date().toISOString(),
      note: input.note?.trim() || null, total_amount: total, created_by: input.userId }).select().single();
    if (result.error || !result.data) throw new Error(result.error?.message ?? "Gagal menyimpan pembelian");
    const purchase = result.data;
    for (const item of input.items) {
      await tx.execute(sql`update public.ingredients set stock_quantity=stock_quantity+${item.quantity},
        cost_per_unit=${item.unit_cost} where id=${item.ingredient_id}`);
    }
    const items = await tx.from("ingredient_purchase_items").insert(input.items.map(item => ({ ...item,
      purchase_id: purchase.id, subtotal: item.quantity * item.unit_cost })));
    if (items.error) throw new Error(items.error.message);
    const movements = await tx.from("stock_movements").insert(input.items.map(item => ({
      company_id: input.companyId, outlet_id: input.outletId, ingredient_id: item.ingredient_id,
      type: "purchase", quantity_change: item.quantity, reference_id: purchase.id,
      note: input.supplier?.trim() || null, created_by: input.userId,
    })));
    if (movements.error) throw new Error(movements.error.message);
    return { success: true, id: purchase.id, total_amount: total };
  });
}

export async function adjustStock(db: DatabaseClient, input: {
  companyId: string; outletId: string; ingredientId: string; userId: string; quantity: number; note?: string;
}) {
  return db.transaction(async tx => {
    const rows = await tx.execute(sql`select stock_quantity from public.ingredients where id=${input.ingredientId}
      and company_id=${input.companyId} and outlet_id=${input.outletId} for update`);
    if (!rows.length) throw new Error("Bahan baku tidak ditemukan");
    const previous = Number(rows[0].stock_quantity);
    const delta = input.quantity - previous;
    await tx.execute(sql`update public.ingredients set stock_quantity=${input.quantity} where id=${input.ingredientId}`);
    const movement = await tx.from("stock_movements").insert({ company_id: input.companyId, outlet_id: input.outletId,
      ingredient_id: input.ingredientId, type: "adjustment", quantity_change: delta, note: input.note ?? null, created_by: input.userId });
    if (movement.error) throw new Error(movement.error.message);
    return { success: true, previous_stock: previous, new_stock: input.quantity, quantity_change: delta };
  });
}
