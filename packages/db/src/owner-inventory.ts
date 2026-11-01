import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DatabaseClient, Row } from "./query";
import { checked } from "./merchant";

export interface OwnerOutletScope { companyId: string; outletId: string; ownerId: string; }
export class InventoryError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "INVENTORY_INVALID") { super(message); }
}
export const INGREDIENT_UNITS = ["gram", "ml", "pcs", "kg", "liter"] as const;
export const INVENTORY_MAX = 9999999999.99;
export function normalizeBusinessCode(value: unknown, prefix: "BHN" | "PRD", optional = false): string | null {
  if (value == null || value === "") {
    if (optional) return null;
    return `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  }
  if (typeof value !== "string") throw new InventoryError("Kode harus berupa teks");
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(code) || /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(code)) {
    throw new InventoryError("Kode wajib 1–64 karakter dan bukan UUID: huruf, angka, titik, garis bawah, atau tanda hubung");
  }
  return code;
}
export function inventoryNumber(value: unknown, label: string, positive = false, max = INVENTORY_MAX): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (positive && value === 0)
    || value > max || Math.abs(value * 100 - Math.round(value * 100)) > 0.001) {
    throw new InventoryError(`${label} harus angka ${positive ? "positif" : "nonnegatif"}, maksimal dua desimal dan tidak melebihi ${max}`);
  }
  return value;
}
export async function assertOwnerOutlet(db: DatabaseClient, scope: OwnerOutletScope) {
  const [outlet] = await db.execute(sql`select o.id from public.outlets o
    join public.companies c on c.id=o.company_id join public.owners a on a.id=c.owner_id
    where o.id=${scope.outletId} and c.id=${scope.companyId} and a.id=${scope.ownerId} and a.is_active=true`);
  if (!outlet) throw new InventoryError("Outlet atau owner tidak valid", 404);
}
function name(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) {
    throw new InventoryError("Nama bahan wajib diisi, maksimal 100 karakter");
  }
  return value.trim();
}
function unit(value: unknown): string {
  if (!INGREDIENT_UNITS.includes(value as typeof INGREDIENT_UNITS[number])) throw new InventoryError("Satuan bahan tidak valid");
  return String(value);
}
export interface IngredientValues {
  code?: string | null; name: string; unit: string; stock_quantity: number; min_stock_alert: number; cost_per_unit: number;
}
export async function createOwnerIngredient(db: DatabaseClient, scope: OwnerOutletScope, input: IngredientValues) {
  const code = normalizeBusinessCode(input.code, "BHN")!;
  const values = { code, name: name(input.name), unit: unit(input.unit),
    stock_quantity: inventoryNumber(input.stock_quantity, "Stok awal"),
    min_stock_alert: inventoryNumber(input.min_stock_alert, "Batas stok minimum"),
    cost_per_unit: inventoryNumber(input.cost_per_unit, "Biaya per satuan") };
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${scope.companyId},0))`);
    await assertOwnerOutlet(tx, scope);
    const duplicateCode = await tx.execute(sql`select id from public.ingredients where company_id=${scope.companyId}
      and outlet_id=${scope.outletId} and lower(code)=lower(${code})`);
    if (duplicateCode.length) throw new InventoryError("Kode bahan sudah dipakai di outlet ini", 409, "IMPORT_CODE_CONFLICT");
    const ingredient = checked(await tx.from("ingredients").insert({ company_id: scope.companyId,
      outlet_id: scope.outletId, ...values, is_active: true }).select().single());
    if (values.stock_quantity > 0) checked(await tx.from("stock_movements").insert({
      company_id: scope.companyId, outlet_id: scope.outletId, ingredient_id: ingredient.id,
      type: "adjustment", quantity_change: values.stock_quantity, note: "Stok awal bahan baku",
      created_by_owner_id: scope.ownerId,
    }));
    return ingredient;
  });
}

export async function updateOwnerIngredient(db: DatabaseClient, scope: OwnerOutletScope, id: string, input: Record<string, unknown>) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${scope.companyId},0))`);
    await assertOwnerOutlet(tx, scope);
    const [previous] = await tx.execute(sql`select * from public.ingredients where id=${id}
      and company_id=${scope.companyId} and outlet_id=${scope.outletId} for update`);
    if (!previous) throw new InventoryError("Bahan baku tidak ditemukan", 404);
    if (input.stock_quantity !== undefined && input.stock_quantity !== Number(previous.stock_quantity)) {
      throw new InventoryError("Gunakan stok opname untuk mengubah jumlah stok");
    }
    const values: Row = {};
    if (input.name !== undefined) values.name = name(input.name);
    if (input.code !== undefined) {
      const next = normalizeBusinessCode(input.code, "BHN")!;
      if (next !== previous.code) throw new InventoryError("Kode bahan tidak dapat diubah; kode adalah identifier tetap", 409);
    }
    if (input.unit !== undefined) values.unit = unit(input.unit);
    if (input.min_stock_alert !== undefined) values.min_stock_alert = inventoryNumber(input.min_stock_alert, "Batas stok minimum");
    if (input.cost_per_unit !== undefined) values.cost_per_unit = inventoryNumber(input.cost_per_unit, "Biaya per satuan");
    if (input.is_active !== undefined) {
      if (typeof input.is_active !== "boolean") throw new InventoryError("Status bahan tidak valid");
      values.is_active = input.is_active;
    }
    if (values.unit && values.unit !== previous.unit) {
      const [used] = await tx.execute(sql`select
        exists(select 1 from public.product_recipes where ingredient_id=${id})
        or exists(select 1 from public.stock_movements where ingredient_id=${id})
        or exists(select 1 from public.ingredient_purchase_items where ingredient_id=${id}) as used`);
      if (Number(previous.stock_quantity) !== 0 || used.used) {
        throw new InventoryError("Satuan bahan yang sudah memiliki stok, riwayat, atau komposisi tidak dapat diubah. Buat bahan baru dengan satuan yang sesuai.", 409);
      }
    }
    const duplicates = await tx.execute(sql`select id from public.ingredients where company_id=${scope.companyId}
      and outlet_id=${scope.outletId} and lower(trim(name))=lower(${values.name ?? previous.name})
      and unit=${values.unit ?? previous.unit} and id<>${id}`);
    if (duplicates.length) throw new InventoryError("Bahan dengan nama dan satuan ini sudah ada", 409);
    if (Object.keys(values).length) checked(await tx.from("ingredients").update(values).eq("id", id));
    return checked(await tx.from("ingredients").select().eq("id", id).single());
  });
}
export async function deleteOwnerIngredient(db: DatabaseClient, scope: OwnerOutletScope, id: string) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${scope.companyId},0))`);
    await assertOwnerOutlet(tx, scope);
    const [ingredient] = await tx.execute(sql`select id from public.ingredients where id=${id}
      and company_id=${scope.companyId} and outlet_id=${scope.outletId} for update`);
    if (!ingredient) throw new InventoryError("Bahan baku tidak ditemukan", 404);
    const [used] = await tx.execute(sql`select
      exists(select 1 from public.product_recipes where ingredient_id=${id})
      or exists(select 1 from public.stock_movements where ingredient_id=${id})
      or exists(select 1 from public.ingredient_purchase_items where ingredient_id=${id}) as used`);
    if (used.used) throw new InventoryError("Bahan memiliki komposisi atau riwayat stok. Nonaktifkan bahan untuk menyimpan riwayatnya.", 409);
    checked(await tx.from("ingredients").delete().eq("id", id));
    return { success: true };
  });
}
