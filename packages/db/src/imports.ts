import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./query";
import { checked } from "./merchant";
import { createOwnerIngredient } from "./owner-inventory";

export type ImportDomain = "products" | "employees" | "ingredients";
export interface StagedImportRow {
  rowNumber: number;
  payload: Record<string, unknown>;
  errors: { field: string | null; message: string }[];
}
export class ImportError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "IMPORT_INVALID") { super(message); }
}

export async function stageImport(db: DatabaseClient, input: {
  companyId: string; domain: ImportDomain; outletId: string | null; fileName: string; rows: StagedImportRow[];
}) {
  if (new Set(input.rows.map(row => row.rowNumber)).size !== input.rows.length) throw new ImportError("Nomor baris staging duplikat");
  return db.transaction(async tx => {
    const valid = input.rows.filter(row => row.errors.length === 0).length;
    const [batch] = await tx.execute(sql`insert into app_private.import_batches
      (company_id,domain,outlet_id,file_name,total_rows,valid_rows,error_rows)
      values (${input.companyId},${input.domain},${input.outletId},${input.fileName},
        ${input.rows.length},${valid},${input.rows.length - valid}) returning id`);
    for (let i = 0; i < input.rows.length; i += 100) {
      const rows = input.rows.slice(i, i + 100).map(row => ({
        row_number: row.rowNumber, payload: Object.fromEntries(Object.entries(row.payload).filter(([key]) => key !== "pin")),
        is_valid: row.errors.length === 0, errors: row.errors,
      }));
      await tx.execute(sql`insert into app_private.import_rows (batch_id,row_number,payload,is_valid,errors)
        select ${batch.id}::uuid,r.row_number,r.payload,r.is_valid,r.errors
        from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
          as r(row_number integer,payload jsonb,is_valid boolean,errors jsonb)`);
    }
    return String(batch.id);
  });
}

const key = (value: unknown) => String(value ?? "").trim().toLowerCase();
function required(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ImportError(`${field} tidak valid. Validasi ulang file.`);
  return value.trim();
}

type WorkRow = { row_number: number; payload: Record<string, unknown>; is_valid: boolean };
const units = new Set(["gram", "ml", "pcs", "kg", "liter"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identity = (name: unknown, unit: unknown) => JSON.stringify([key(name), key(unit)]);
function invalid(row: WorkRow, message: string): never {
  throw new ImportError(`${String(row.payload.sheet_name ?? "Data")} baris ${row.payload.sheet_row ?? row.row_number}: ${message}. Validasi ulang file.`, 409);
}
function amount(value: unknown, row: WorkRow, field: string, max = 9999999999.99, positive = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !/^\d+(\.\d{1,2})?$/.test(String(value)) ||
    value > max || (positive ? value <= 0 : value < 0)) invalid(row, `${field} tidak valid (maksimal 2 desimal)`);
  return value;
}

/** Re-resolve only against this outlet, under the same company/quota transaction lock. */
async function ingredientPlan(tx: DatabaseClient, companyId: string, outletId: string, rows: WorkRow[], recipeRows: WorkRow[], productRows: WorkRow[]) {
  const existing = rows.length || recipeRows.length ? await tx.execute(sql`select id,name,unit,is_active from public.ingredients
    where company_id=${companyId} and outlet_id=${outletId} order by id for share`) : [];
  const byId = new Map(existing.map(row => [key(row.id), row]));
  const declarations = new Map<string, { row: WorkRow; id?: string; unit: string; values: {
    name: string; unit: string; stock_quantity: number; cost_per_unit: number; min_stock_alert: number;
  } }>();
  const identities = new Set<string>();
  for (const row of rows) {
    const p = row.payload;
    const code = key(required(p.ingredient_code, "Kode bahan"));
    if (declarations.has(code)) invalid(row, "Kode bahan duplikat");
    const name = required(p.name, "Nama bahan"); const unit = required(p.unit, "Satuan");
    if (name.length > 100 || !units.has(unit)) invalid(row, "Nama/satuan bahan tidak valid");
    const matches = existing.filter(ref => identity(ref.name, ref.unit) === identity(name, unit));
    let id: string | undefined;
    let values = { name, unit, stock_quantity: 0, cost_per_unit: 0, min_stock_alert: 0 };
    if (p.ingredient_mode === "existing") {
      const referenceId = key(p.resolved_ingredient_id);
      if (!uuid.test(referenceId)) invalid(row, "ID bahan lama tidak valid");
      const ref = byId.get(referenceId);
      if (!ref || ref.is_active === false) invalid(row, "Bahan aktif tidak ditemukan di outlet tujuan");
      if (identity(ref.name, ref.unit) !== identity(name, unit)) invalid(row, "Nama/satuan bahan lama berubah atau tidak cocok");
      if (p.ingredient_id ? key(p.ingredient_id) !== referenceId : matches.length !== 1) invalid(row, "Referensi bahan ambigu atau berubah");
      for (const field of ["stock_quantity", "cost_per_unit", "min_stock_alert"]) {
        if (p[field] !== null && p[field] !== undefined && p[field] !== 0) invalid(row, "Bahan lama hanya referensi; stok/biaya/minimum tidak boleh diubah");
      }
      id = String(ref.id);
    } else if (p.ingredient_mode === "new") {
      if (p.ingredient_id || p.resolved_ingredient_id || existing.some(ref => key(ref.name) === key(name))) invalid(row, "Bahan dengan nama ini sudah ada; jangan membuat ulang atau mengonversi satuan");
      values = { name, unit, stock_quantity: amount(p.stock_quantity, row, "Stok awal"),
        cost_per_unit: amount(p.cost_per_unit, row, "Biaya"), min_stock_alert: amount(p.min_stock_alert, row, "Stok minimum") };
    } else invalid(row, "Status bahan belum divalidasi");
    const marker = id ? `id:${key(id)}` : identity(name, unit);
    if (identities.has(marker)) invalid(row, "Bahan yang sama dideklarasikan dua kali");
    identities.add(marker);
    declarations.set(code, { row, id, unit, values });
  }
  const productsByCode = new Map<string, WorkRow>();
  for (const row of productRows) {
    const code = key(row.payload.product_code);
    if (!code) continue;
    if (productsByCode.has(code)) invalid(row, "Kode produk duplikat");
    productsByCode.set(code, row);
  }
  const pairs = new Set<string>();
  const recipes = recipeRows.map(row => {
    const p = row.payload; const productCode = key(p.product_code); const ingredientCode = key(p.ingredient_code);
    if (!productCode || !productsByCode.has(productCode)) invalid(row, "Kode produk tidak ditemukan");
    if (!!ingredientCode === !!p.ingredient_id) invalid(row, "Isi tepat satu kode_bahan atau id_bahan");
    const declaration = ingredientCode ? declarations.get(ingredientCode) : undefined;
    const ref = p.ingredient_id ? byId.get(key(p.ingredient_id)) : undefined;
    if (ingredientCode ? !declaration : !ref || ref.is_active === false) invalid(row, "Bahan aktif tidak ditemukan di outlet tujuan");
    const unit = declaration?.unit ?? String(ref!.unit);
    if ((!declaration && !p.resolved_unit && !p.unit) ||
      (p.resolved_unit && key(p.resolved_unit) !== key(unit)) || (p.unit && key(p.unit) !== key(unit))) {
      invalid(row, "Satuan resep tidak cocok atau berubah; tidak ada konversi otomatis");
    }
    const id = declaration?.id ?? (ref ? String(ref.id) : undefined);
    const pair = JSON.stringify([productCode, id ? `id:${key(id)}` : `code:${ingredientCode}`]);
    if (pairs.has(pair)) invalid(row, "Pasangan produk+bahan duplikat");
    pairs.add(pair);
    return { productCode, ingredientCode, id, quantity: amount(p.quantity_used, row, "Jumlah per porsi", 9999999999.99, true) };
  });
  return { declarations, recipes, newCount: [...declarations.values()].filter(item => !item.id).length };
}

/** One transaction owns the batch, its company quota and all resulting writes. */
export async function confirmImport(db: DatabaseClient, input: {
  companyId: string; batchId: string; ownerId?: string;
  checkQuota: (tx: DatabaseClient, domain: ImportDomain, count: number) => Promise<boolean>;
}) {
  return db.transaction(async tx => {
    // Same company lock as employee writes; serializes competing import batches.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.companyId},0))`);
    const [batch] = await tx.execute(sql`select id,domain,outlet_id,status,imported_rows
      from app_private.import_batches where id=${input.batchId} and company_id=${input.companyId} for update`);
    if (!batch) throw new ImportError("Batch tidak ditemukan", 404);
    if (batch.status === "confirmed") return { imported: Number(batch.imported_rows), failed: 0, replayed: true };
    if (batch.status !== "validated") throw new ImportError("Batch tidak dapat diproses. Unggah ulang file.", 409);
    const domain = batch.domain as ImportDomain;
    if (domain !== "products" && domain !== "employees" && domain !== "ingredients") throw new ImportError("Domain tidak valid");
    const allRows = await tx.execute(sql`select row_number,payload,is_valid from app_private.import_rows
      where batch_id=${batch.id} order by row_number`) as WorkRow[];
    const linked = domain === "ingredients" || allRows.some(row => row.payload.linked_workbook === true || ["ingredient", "recipe"].includes(String(row.payload.kind)));
    if (linked && allRows.some(row => !row.is_valid)) throw new ImportError("Workbook terkait masih memiliki kesalahan. Perbaiki seluruh sheet dan unggah ulang.", 409, "IMPORT_LINKED_ERRORS");
    const rows = allRows.filter(row => row.is_valid);
    if (!rows.length) throw new ImportError("Tidak ada baris valid untuk diimpor");
    const mainKind = domain === "products" ? "product" : domain === "ingredients" ? "ingredient" : "employee";
    const kind = (row: WorkRow) => String(row.payload.kind ?? mainKind);
    if (rows.some(row => ![mainKind, ...(domain === "products" ? ["ingredient", "recipe"] : [])].includes(kind(row)))) throw new ImportError("Jenis baris tidak valid");
    const mainRows = rows.filter(row => kind(row) === mainKind);
    const ingredientRows = rows.filter(row => kind(row) === "ingredient");
    const recipeRows = rows.filter(row => kind(row) === "recipe");
    if (!mainRows.length || allRows.filter(row => kind(row) === mainKind).length > (domain === "employees" ? 100 : 500) ||
      allRows.filter(row => kind(row) === "ingredient").length > 500 || allRows.filter(row => kind(row) === "recipe").length > 2000) throw new ImportError("Jumlah baris impor tidak valid");
    if (domain !== "ingredients" && !(await input.checkQuota(tx, domain, mainRows.length))) {
      throw new ImportError("Kuota paket berubah atau sudah penuh. Validasi ulang file atau upgrade paket.", 403, "PLAN_LIMIT");
    }

    let newIngredients = 0;
    if (domain === "products" || domain === "ingredients") {
      const [outlet] = await tx.execute(sql`select id from public.outlets
        where id=${batch.outlet_id} and company_id=${input.companyId} for share`);
      if (!outlet) throw new ImportError("Outlet tujuan tidak ditemukan", 409);
      const plan = await ingredientPlan(tx, input.companyId, String(outlet.id), ingredientRows, recipeRows, domain === "products" ? mainRows : []);
      newIngredients = plan.newCount;
      if (newIngredients && !input.ownerId) throw new ImportError("Sesi owner diperlukan untuk membuat bahan", 403);
      if (newIngredients && !(await input.checkQuota(tx, "ingredients", newIngredients))) throw new ImportError("Kuota bahan baku paket berubah atau sudah penuh. Validasi ulang file atau upgrade paket.", 403, "PLAN_LIMIT");
      for (const declaration of plan.declarations.values()) {
        if (!declaration.id) {
          const ingredient = await createOwnerIngredient(tx, { companyId: input.companyId, outletId: String(outlet.id), ownerId: input.ownerId! }, declaration.values);
          declaration.id = String(ingredient.id);
        }
      }
      if (domain === "products") {
        const existing = await tx.execute(sql`select name from public.products
          where company_id=${input.companyId} and outlet_id=${outlet.id}`);
        const names = new Set(existing.map(row => key(row.name)));
        const cats = await tx.execute(sql`select id,name,sort_order from public.categories
          where company_id=${input.companyId} and outlet_id=${outlet.id}`);
        const categories = new Map(cats.map(row => [key(row.name), String(row.id)]));
        let sort = Math.max(0, ...cats.map(row => Number(row.sort_order) || 0));
        const products = [];
        for (const row of mainRows) {
          const payload = row.payload;
          const name = required(payload.name, "Nama produk");
          if (names.has(key(name))) invalid(row, `Produk "${name}" sudah ada`);
          names.add(key(name));
          const category = required(payload.category_name, "Kategori");
          let categoryId = categories.get(key(category));
          if (!categoryId) {
            const [created] = await tx.execute(sql`insert into public.categories(company_id,outlet_id,name,sort_order)
              values(${input.companyId},${outlet.id},${category},${++sort}) returning id`);
            categoryId = String(created.id);
            categories.set(key(category), categoryId);
          }
          const price = amount(payload.price, row, "Harga", 99999999.99);
          if (name.length > 100 || category.length > 60) invalid(row, "Nama/kategori terlalu panjang");
          products.push({ company_id: input.companyId, outlet_id: outlet.id, category_id: categoryId,
            name, price, description: payload.description || null, is_active: true });
        }
        const productIds = new Map<string, string>();
        for (let i = 0; i < products.length; i += 100) {
          const created = checked(await tx.from("products").insert(products.slice(i, i + 100)).select("id,name"));
          for (const product of created) productIds.set(key(product.name), String(product.id));
        }
        const byCode = new Map(mainRows.filter(row => row.payload.product_code).map(row => [key(row.payload.product_code), productIds.get(key(row.payload.name))!]));
        const recipeRecords = plan.recipes.map(recipe => ({ product_id: byCode.get(recipe.productCode),
          ingredient_id: recipe.id ?? plan.declarations.get(recipe.ingredientCode)!.id, quantity_used: recipe.quantity }));
        for (let i = 0; i < recipeRecords.length; i += 100) checked(await tx.from("product_recipes").insert(recipeRecords.slice(i, i + 100)));
      }
    } else {
      const roles = await tx.execute(sql`select id,name from public.roles where company_id=${input.companyId} for share`);
      const outlets = await tx.execute(sql`select id,name from public.outlets where company_id=${input.companyId} for share`);
      const users = await tx.execute(sql`select lower(username) as username from public.users where company_id=${input.companyId}`);
      const usernames = new Set(users.map(row => String(row.username)));
      const roleMap = new Map(roles.map(row => [key(row.name), String(row.id)]));
      const outletMap = new Map(outlets.map(row => [key(row.name), String(row.id)]));
      const assignments = new Map<string, string[]>();
      const records = rows.map(row => {
        const payload = row.payload as Record<string, unknown>;
        const name = required(payload.name, "Nama karyawan");
        const username = key(required(payload.username, "Username"));
        if (usernames.has(username)) throw new ImportError(`Username "${username}" sudah dipakai. Validasi ulang file.`, 409);
        usernames.add(username);
        const roleId = roleMap.get(key(payload.role_name));
        if (!roleId) throw new ImportError(`Role baris ${row.row_number} tidak ditemukan`, 409);
        const names = Array.isArray(payload.outlet_names) ? payload.outlet_names : [];
        const all = names.includes("__ALL__");
        const ids = all ? [] : names.map(value => {
          const id = outletMap.get(key(value));
          if (!id) throw new ImportError(`Outlet baris ${row.row_number} tidak ditemukan`, 409);
          return id;
        });
        if (!all && !ids.length) throw new ImportError("Pilih minimal satu outlet");
        assignments.set(username, [...new Set(ids)]);
        return { company_id: input.companyId, name, username, role_id: roleId, all_outlets: all,
          pin_hash: required(payload.pin_hash, "PIN"), status: "active" };
      });
      const created = checked(await tx.from("users").insert(records).select("id,username"));
      const links = created.flatMap((user: { id: string; username: string }) =>
        (assignments.get(user.username) ?? []).map(outlet_id => ({ user_id: user.id, outlet_id })));
      if (links.length) checked(await tx.from("user_outlets").insert(links));
    }

    await tx.execute(sql`update app_private.import_batches set status='confirmed', confirmed_at=now(),
      imported_rows=${mainRows.length} where id=${batch.id}`);
    // Hashes are only needed until successful confirmation, never in history previews.
    await tx.execute(sql`update app_private.import_rows set payload=payload - 'pin' - 'pin_hash'
      where batch_id=${batch.id}`);
    return { imported: mainRows.length, failed: 0, replayed: false, new_ingredients: newIngredients, recipes: recipeRows.length };
  });
}
