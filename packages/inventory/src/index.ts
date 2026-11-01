import { sql, type DatabaseClient } from "@rakku/db";
import { inventoryNumber, InventoryError, INVENTORY_MAX } from "@rakku/db/owner-inventory";

async function actor(db: DatabaseClient, input: { companyId: string; userId: string | null; ownerId?: string }) {
  if (input.ownerId) {
    if (input.userId) throw new InventoryError("Pelaku inventori tidak valid");
    const [company] = await db.execute(sql`select id from public.companies where id=${input.companyId} and owner_id=${input.ownerId}`);
    if (!company) throw new InventoryError("Owner tidak memiliki perusahaan ini", 403);
  }
  return input.ownerId ? { created_by: null, created_by_owner_id: input.ownerId } : { created_by: input.userId };
}
function subtotal(quantity: number, cost: number) {
  const cents = (BigInt(Math.round(quantity * 100)) * BigInt(Math.round(cost * 100)) + BigInt(50)) / BigInt(100);
  if (cents > BigInt(99999999999999)) throw new InventoryError("Nilai pembelian terlalu besar");
  return Number(cents) / 100;
}

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
  companyId: string; outletId: string; userId: string | null; ownerId?: string; supplier?: string; date?: string; note?: string;
  items: PurchaseItemInput[];
}) {
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 100) throw new InventoryError("Isi 1–100 baris pembelian");
  if (new Set(input.items.map(item => item.ingredient_id)).size !== input.items.length) throw new InventoryError("Bahan duplikat dalam pembelian");
  const subtotals = input.items.map(item => subtotal(inventoryNumber(item.quantity, "Jumlah pembelian", true), inventoryNumber(item.unit_cost, "Biaya per satuan")));
  const total = subtotals.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
  if (total > 999999999999.99) throw new InventoryError("Total pembelian terlalu besar");
  if (input.date && !Number.isFinite(Date.parse(input.date))) throw new InventoryError("Tanggal pembelian tidak valid");
  return db.transaction(async tx => {
    const attribution = await actor(tx, input);
    const ids = Array.from(new Set(input.items.map(item => item.ingredient_id)));
    const locked = await tx.execute(sql`select id,stock_quantity,is_active from public.ingredients where company_id=${input.companyId}
      and outlet_id=${input.outletId} and id in (${sql.join(ids.map(id => sql`${id}::uuid`), sql`, `)}) order by id for update`);
    if (locked.length !== ids.length) throw new InventoryError("Bahan tidak ditemukan pada outlet ini", 404);
    for (const item of input.items) {
      const previous = locked.find(row => row.id === item.ingredient_id)!;
      if (!previous.is_active) throw new InventoryError("Bahan nonaktif tidak dapat dibeli");
      if (Math.abs(Number(previous.stock_quantity) + item.quantity) > INVENTORY_MAX) throw new InventoryError("Stok hasil pembelian terlalu besar");
    }
    const result = await tx.from("ingredient_purchases").insert({ company_id: input.companyId, outlet_id: input.outletId,
      supplier_name: input.supplier?.trim() || null, purchase_date: input.date ?? new Date().toISOString(),
      note: input.note?.trim() || null, total_amount: total, ...attribution }).select().single();
    if (result.error || !result.data) throw new Error(result.error?.message ?? "Gagal menyimpan pembelian");
    const purchase = result.data;
    for (const item of input.items) {
      await tx.execute(sql`update public.ingredients set stock_quantity=stock_quantity+${item.quantity},
        cost_per_unit=${item.unit_cost} where id=${item.ingredient_id}`);
    }
    const items = await tx.from("ingredient_purchase_items").insert(input.items.map((item, index) => ({ ...item,
      purchase_id: purchase.id, subtotal: subtotals[index] })));
    if (items.error) throw new Error(items.error.message);
    const movements = await tx.from("stock_movements").insert(input.items.map(item => ({
      company_id: input.companyId, outlet_id: input.outletId, ingredient_id: item.ingredient_id,
      type: "purchase", quantity_change: item.quantity, reference_id: purchase.id,
      note: input.note?.trim() || input.supplier?.trim() || null, ...attribution,
    })));
    if (movements.error) throw new Error(movements.error.message);
    return { success: true, id: purchase.id, total_amount: total };
  });
}

export async function adjustStock(db: DatabaseClient, input: {
  companyId: string; outletId: string; ingredientId: string; userId: string | null; ownerId?: string; quantity: number; note?: string;
}) {
  inventoryNumber(input.quantity, "Stok fisik");
  return db.transaction(async tx => {
    const attribution = await actor(tx, input);
    const rows = await tx.execute(sql`select stock_quantity from public.ingredients where id=${input.ingredientId}
      and company_id=${input.companyId} and outlet_id=${input.outletId} for update`);
    if (!rows.length) throw new InventoryError("Bahan baku tidak ditemukan", 404);
    const previous = Number(rows[0].stock_quantity);
    const delta = input.quantity - previous;
    if (Math.abs(delta) > INVENTORY_MAX) throw new InventoryError("Selisih stok terlalu besar");
    if (delta === 0) return { success: true, previous_stock: previous, new_stock: input.quantity, quantity_change: 0 };
    await tx.execute(sql`update public.ingredients set stock_quantity=${input.quantity} where id=${input.ingredientId}`);
    const movement = await tx.from("stock_movements").insert({ company_id: input.companyId, outlet_id: input.outletId,
      ingredient_id: input.ingredientId, type: "adjustment", quantity_change: delta, note: input.note ?? null, ...attribution });
    if (movement.error) throw new Error(movement.error.message);
    return { success: true, previous_stock: previous, new_stock: input.quantity, quantity_change: delta };
  });
}
