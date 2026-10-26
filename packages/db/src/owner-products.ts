import { sql } from "drizzle-orm";
import type { DatabaseClient, Row } from "./query";
import { checked, replaceProductTierPrices } from "./merchant";
import { assertOwnerOutlet, InventoryError, inventoryNumber, type OwnerOutletScope } from "./owner-inventory";

export interface ProductRecipeInput { ingredient_id: string; quantity_used: number; }
export async function saveOwnerProduct(db: DatabaseClient, scope: OwnerOutletScope, input: Record<string, unknown>, options: {
  productId?: string;
  checkQuota?: (tx: DatabaseClient) => Promise<boolean>;
} = {}) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${scope.companyId},0))`);
    await assertOwnerOutlet(tx, scope);
    const previous = options.productId ? (await tx.execute(sql`select * from public.products where id=${options.productId}
      and company_id=${scope.companyId} and outlet_id=${scope.outletId} for update`))[0] : null;
    if (options.productId && !previous) throw new InventoryError("Produk tidak ditemukan", 404);
    if (!previous && options.checkQuota && !(await options.checkQuota(tx))) throw new InventoryError("Kuota produk paket Anda sudah penuh", 403, "PLAN_LIMIT");
    const values: Row = {};
    if (input.name !== undefined || !previous) {
      if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100) throw new InventoryError("Nama produk wajib diisi, maksimal 100 karakter");
      values.name = input.name.trim();
    }
    if (input.price !== undefined || !previous) values.price = inventoryNumber(input.price ?? 0, "Harga produk", false, 99999999.99);
    if (input.category_id !== undefined || !previous) {
      if (typeof input.category_id !== "string") throw new InventoryError("Kategori wajib dipilih");
      const category = checked(await tx.from("categories").select("id").eq("id", input.category_id)
        .eq("company_id", scope.companyId).eq("outlet_id", scope.outletId).maybeSingle());
      if (!category) throw new InventoryError("Kategori tidak tersedia di outlet ini");
      values.category_id = input.category_id;
    }
    if (input.description !== undefined) {
      if (input.description !== null && (typeof input.description !== "string" || input.description.length > 5000)) throw new InventoryError("Deskripsi maksimal 5000 karakter");
      values.description = input.description || null;
    }
    if (input.is_active !== undefined) {
      if (typeof input.is_active !== "boolean") throw new InventoryError("Status produk tidak valid");
      values.is_active = input.is_active;
    }
    if (input.image_url !== undefined) {
      if (input.image_url !== null && typeof input.image_url !== "string") throw new InventoryError("Gambar tidak valid");
      values.image_url = input.image_url;
    }
    let recipes: ProductRecipeInput[] | undefined;
    if (input.recipes !== undefined) {
      if (!Array.isArray(input.recipes) || input.recipes.length > 500) throw new InventoryError("Komposisi maksimal 500 bahan");
      recipes = input.recipes.map(row => {
        if (!row || typeof row.ingredient_id !== "string") throw new InventoryError("Bahan komposisi tidak valid");
        return { ingredient_id: row.ingredient_id, quantity_used: inventoryNumber(row.quantity_used, "Pemakaian per porsi", true) };
      });
      const ids = recipes.map(row => row.ingredient_id);
      if (new Set(ids).size !== ids.length) throw new InventoryError("Bahan komposisi duplikat");
      if (ids.length) {
        const ingredients = checked(await tx.from("ingredients").select("id,is_active").eq("company_id", scope.companyId)
          .eq("outlet_id", scope.outletId).in("id", ids));
        if (ingredients.length !== ids.length) throw new InventoryError("Bahan komposisi tidak tersedia di outlet ini");
        const saved = previous ? checked(await tx.from("product_recipes").select("ingredient_id").eq("product_id", previous.id)) : [];
        if (ingredients.some((row: Row) => !row.is_active && !saved.some((old: Row) => old.ingredient_id === row.id))) {
          throw new InventoryError("Bahan nonaktif tidak dapat ditambahkan ke komposisi baru");
        }
      }
    }
    const product = previous
      ? Object.keys(values).length ? checked(await tx.from("products").update(values).eq("id", previous.id).select().single()) : previous
      : checked(await tx.from("products").insert({ ...values, company_id: scope.companyId, outlet_id: scope.outletId }).select().single());
    if (input.prices !== undefined) {
      if (!Array.isArray(input.prices) || input.prices.length > 100 || input.prices.some(row => !row || typeof row.tier_id !== "string")) throw new InventoryError("Harga tier tidak valid");
      await replaceProductTierPrices(tx, scope.companyId, product.id, input.prices.map(row => ({ tier_id: row.tier_id,
        price: inventoryNumber(row.price, "Harga tier", false, 99999999.99) })));
    }
    if (recipes !== undefined) {
      checked(await tx.from("product_recipes").delete().eq("product_id", product.id));
      if (recipes.length) checked(await tx.from("product_recipes").insert(recipes.map(row => ({ ...row, product_id: product.id }))));
    }
    return product;
  });
}
