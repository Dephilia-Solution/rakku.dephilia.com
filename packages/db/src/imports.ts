import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { DatabaseClient, Row } from "./query";
import { checked, saveEmployee, replaceProductTierPrices } from "./merchant";
import { createOwnerIngredient, updateOwnerIngredient, InventoryError } from "./owner-inventory";
import { ensureOutletCategory } from "./categories";

export type ImportDomain = "products" | "employees" | "ingredients" | "purchases";
export type ImportConflictMode = "skip" | "update";
export interface StagedImportRow { rowNumber: number; payload: Record<string, unknown>; errors: { field: string | null; message: string }[]; warnings?: { field: string | null; message: string }[]; }
interface StagedRecord extends StagedImportRow { is_valid: boolean; }
export class ImportError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "IMPORT_INVALID") { super(message); }
}
const key = (value: unknown) => String(value ?? "").trim().normalize("NFKC").toLocaleUpperCase("id-ID");
function required(value: unknown, field: string, row?: StagedImportRow): string {
  if (typeof value !== "string" || !value.trim()) throw new ImportError(row ? `${String(row.payload.sheet_name)} baris ${row.payload.sheet_row}, kolom ${field}: wajib diisi.` : `${field} tidak valid.`);
  return value.trim();
}
function amount(value: unknown, field: string, positive = false, row?: StagedImportRow, maximum = 9999999999.99): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value > maximum || value < (positive ? Number.EPSILON : 0) || (positive && Math.round(value*100)===0) || Math.abs(Math.round(value * 100) - value * 100) > 0.001) {
    throw new ImportError(row ? `${String(row.payload.sheet_name)} baris ${row.payload.sheet_row}, kolom ${field}: angka tidak valid (maksimal dua desimal).` : `${field} tidak valid.`);
  }
  return Math.round(value * 100) / 100;
}
function invalid(row: StagedImportRow, field: string, message: string): never {
  throw new ImportError(`${String(row.payload.sheet_name)} baris ${row.payload.sheet_row}, kolom ${field}: ${message}.`, 409, "IMPORT_REFERENCE_INVALID");
}
function conflictMode(value: unknown = "skip"): ImportConflictMode {
  if (value === "skip" || value === "update") return value;
  throw new ImportError("Pilih tindakan untuk kode existing: lewati atau perbarui.", 400, "IMPORT_CONFLICT_MODE_REQUIRED");
}
function fromInventory(error: unknown): never {
  if (error instanceof InventoryError) throw new ImportError(error.message, error.status, error.code);
  throw error;
}

export async function stageImport(db: DatabaseClient, input: {
  companyId: string; domain: ImportDomain; outletId: string | null; fileName: string; rows: StagedImportRow[];
  ownerId?: string; schemaVersion?: 1 | 2; context?: Record<string, unknown>; assets?: StagedImportAsset[];
}) {
  if (new Set(input.rows.map(row => row.rowNumber)).size !== input.rows.length) throw new ImportError("Nomor baris staging duplikat.");
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.companyId},0))`);
    const [pending] = await tx.execute(sql`select count(*) as count from app_private.import_batches where company_id=${input.companyId} and status='validated' and expires_at>now()`);
    if (Number(pending.count) >= 10) throw new ImportError("Maksimal 10 preview aktif. Konfirmasi preview yang tersedia atau tunggu kedaluwarsa.",429,"IMPORT_PENDING_LIMIT");
    const incomingBytes = (input.assets ?? []).reduce((sum,asset)=>sum+asset.bytes.length,0);
    if (incomingBytes) {
      const [stored] = await tx.execute(sql`select coalesce(sum(byte_size),0) as bytes from app_private.import_assets where company_id=${input.companyId} and state in ('staged','uploaded','cleanup_pending')`);
      if (Number(stored.bytes)+incomingBytes>32*1024*1024) throw new ImportError("Batas staging gambar perusahaan 32 MB. Konfirmasi/bersihkan preview terdahulu.",429,"IMPORT_STAGING_LIMIT");
    }
    const valid = input.rows.filter(row => row.errors.length === 0).length;
    const [batch] = await tx.execute(sql`insert into app_private.import_batches
      (company_id,domain,outlet_id,file_name,total_rows,valid_rows,error_rows,schema_version,context,created_by_owner_id)
      values (${input.companyId},${input.domain},${input.outletId},${input.fileName},
        ${input.rows.length},${valid},${input.rows.length - valid},${input.schemaVersion ?? 1},${JSON.stringify(input.context ?? {})}::jsonb,${input.ownerId ?? null}) returning id`);
    const assets = input.assets ?? [];
    if (assets.length > 100 || assets.reduce((sum, asset) => sum + asset.bytes.length, 0) > 12 * 1024 * 1024) throw new ImportError("Batas gambar staging terlampaui.");
    const assetIds = new Map<string,string>();
    for (let offset=0;offset<assets.length;offset+=10) {
      const chunk=assets.slice(offset,offset+10).map(asset=>{
        if(input.domain!=="products" || !input.outletId || asset.bytes.length>2*1024*1024)throw new ImportError("Scope gambar staging tidak valid.");
        return {reference:asset.reference,content_hash:createHash("sha256").update(asset.bytes).digest("hex"),processed_base64:asset.bytes.toString("base64"),byte_size:asset.bytes.length,width:asset.width,height:asset.height};
      });
      const saved=await tx.execute(sql`insert into app_private.import_assets(batch_id,company_id,outlet_id,reference,content_hash,processed_base64,byte_size,width,height)
        select ${batch.id}::uuid,${input.companyId}::uuid,${input.outletId}::uuid,r.reference,r.content_hash,r.processed_base64,r.byte_size,r.width,r.height
        from jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) as r(reference text,content_hash text,processed_base64 text,byte_size integer,width integer,height integer) returning id,reference`);
      for(const asset of saved)assetIds.set(String(asset.reference),String(asset.id));
    }
    for (let i = 0; i < input.rows.length; i += 500) {
      const staged = input.rows.slice(i, i + 500).map(row => ({ row_number: row.rowNumber,
        payload: { ...Object.fromEntries(Object.entries(row.payload).filter(([property]) => !["pin", "image_asset_id"].includes(property))),
          ...(assetIds.has(String(row.payload.image_reference_normalized)) ? { image_asset_id: assetIds.get(String(row.payload.image_reference_normalized)) } : {}) },
        is_valid: row.errors.length === 0, errors: row.errors, warnings: row.warnings ?? [] }));
      await tx.execute(sql`insert into app_private.import_rows (batch_id,row_number,payload,is_valid,errors,warnings)
        select ${batch.id}::uuid,r.row_number,r.payload,r.is_valid,r.errors,r.warnings
        from jsonb_to_recordset(${JSON.stringify(staged)}::jsonb) as r(row_number integer,payload jsonb,is_valid boolean,errors jsonb,warnings jsonb)`);
    }
    return String(batch.id);
  });
}

export interface StagedImportAsset { reference: string; bytes: Buffer; width: number; height: number; }
export interface ImportPurchaseInput {
  companyId: string; outletId: string; ownerId: string; userId: null; supplier: string; note: string; date: string;
  items: { ingredient_id: string; quantity: number; unit_cost: number }[];
}
export interface ImportConfirmationResult {
  imported:number;created:number;updated:number;skipped:number;recipes:number;categories_created:number;
  tier_prices:number;images:number;purchases:{reference:string;id:string|null;replayed:boolean;total_amount?:number}[];replayed:boolean;
}

/** File identity and line order do not affect dedupe. Header order DOES control execution:
 * first sheet row first; the last newly-recorded header wins ingredient cost (recordPurchase policy),
 * even when its date is earlier. Replayed references never update stock or last cost. */
export function importPurchaseHash(header: StagedImportRow, lines: StagedImportRow[]) {
  const p = header.payload;
  const details = lines.filter(line => key(line.payload.purchase_code) === key(p.code)).map(line => ({
    ingredient_code: key(line.payload.ingredient_code), quantity: Number(line.payload.quantity), unit: String(line.payload.unit), unit_cost: Number(line.payload.unit_cost),
  })).sort((a,b) => a.ingredient_code < b.ingredient_code ? -1 : a.ingredient_code > b.ingredient_code ? 1 : 0);
  return createHash("sha256").update(JSON.stringify({ reference: key(p.code), date: p.date, supplier: p.supplier ?? "", note: p.note ?? "", details })).digest("hex");
}

interface ProductRecord extends Row { id: string; code: string; name: string; category_id: string; }
interface IngredientRecord extends Row { id: string; code: string; name: string; unit: string; is_active: boolean; }

/** Confirmation is one transaction: code conflicts, categories, business data, and linked recipes commit or roll back together. */
export async function confirmImport(db: DatabaseClient, input: {
  companyId: string; batchId: string; ownerId?: string; conflictMode?: ImportConflictMode; allowNewCategories?: boolean;
  checkQuota: (tx: DatabaseClient, domain: ImportDomain, count: number) => Promise<boolean>;
  checkInventoryAdvanced?: (tx: DatabaseClient) => Promise<boolean>;
  recordPurchase?: (tx: DatabaseClient, values: ImportPurchaseInput) => Promise<{ id: string; total_amount: number }>;
  imageLeaseToken?: string;
}):Promise<ImportConfirmationResult> {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.companyId},0))`);
    const [batch] = await tx.execute(sql`select *
      from app_private.import_batches where id=${input.batchId} and company_id=${input.companyId} for update`);
    if (!batch) throw new ImportError("Batch tidak ditemukan.", 404);
    if (batch.created_by_owner_id && batch.created_by_owner_id !== input.ownerId) throw new ImportError("Owner batch tidak sesuai sesi.", 403);
    if (batch.status === "confirmed") return { ...(batch.confirmation_result ?? { imported: Number(batch.imported_rows), created: Number(batch.imported_rows), updated: 0, skipped: 0, recipes: 0, categories_created: 0,tier_prices:0,images:0,purchases:[] }), replayed: true };
    if (batch.status !== "validated") throw new ImportError("Batch tidak dapat diproses. Validasi file kembali.", 409);
    if (new Date(batch.expires_at).getTime() <= Date.now()) throw new ImportError("Preview import kedaluwarsa. Unggah dan validasi ulang.", 409, "IMPORT_EXPIRED");
    if (input.ownerId) {
      const [owner] = await tx.execute(sql`select c.id from public.companies c join public.owners o on o.id=c.owner_id
        where c.id=${input.companyId} and o.id=${input.ownerId} and o.is_active=true for share of c,o`);
      if (!owner) throw new ImportError("Owner tidak memiliki perusahaan ini.", 403);
    }
    if (batch.image_lease_token && (batch.image_lease_token !== input.imageLeaseToken || new Date(batch.image_lease_until).getTime() <= Date.now())) {
      throw new ImportError("Gambar sedang diproses atau lease berakhir. Coba kembali.", 409, "IMPORT_BUSY");
    }
    const mode = conflictMode(input.conflictMode ?? "skip");
    const domain = batch.domain as ImportDomain;
    if (!["products", "employees", "ingredients", "purchases"].includes(domain)) throw new ImportError("Jenis import tidak valid.");
    const allRows = (await tx.execute(sql`select row_number as "rowNumber",payload,is_valid from app_private.import_rows where batch_id=${batch.id} order by row_number`)) as StagedRecord[];
    if (batch.context?.structural_errors?.length) throw new ImportError("Struktur workbook tidak valid. Unggah ulang.", 409, "IMPORT_STRUCTURE_INVALID");
    const isLinked = domain === "purchases" || batch.context?.linked === true || domain === "products" && allRows.some(row => row.payload.linked_workbook === true);
    if (isLinked && allRows.some(row => !row.is_valid)) throw new ImportError("Ada baris error pada workbook terkait. Perbaiki semua sheet/baris lalu unggah ulang.", 409, "IMPORT_LINKED_ERRORS");
    const rows = allRows.filter(row => row.is_valid);
    const mainKind = domain === "products" ? "product" : domain === "ingredients" ? "ingredient" : domain === "purchases" ? "purchase" : "employee";
    const rowKind = (row: StagedImportRow) => String(row.payload.kind ?? mainKind);
    const mains = rows.filter(row => rowKind(row) === mainKind);
    const recipes = rows.filter(row => rowKind(row) === "recipe");
    if (!mains.length && !(domain === "products" && recipes.length)) throw new ImportError("Tidak ada baris utama yang dapat diproses.");
    if (allRows.filter(row => rowKind(row) === mainKind).length > (["employees", "purchases"].includes(domain) ? 100 : 500)
      || allRows.filter(row => rowKind(row) === "recipe").length > 2000 || allRows.filter(row => rowKind(row) === "purchase_line").length > 10000) throw new ImportError("Batas jumlah baris import terlampaui.");
    let created = 0, updated = 0, skipped = 0, recipesSaved = 0, categoriesCreated = 0;
    let tierPricesSaved = 0, imagesAttached = 0;
    const purchaseResults: { reference: string; id: string | null; replayed: boolean; total_amount?: number }[] = [];

    if (domain === "purchases") {
      if (!input.ownerId || !input.checkInventoryAdvanced || !input.recordPurchase) throw new ImportError("Layanan pembelian import belum dikonfigurasi.", 500);
      if (!(await input.checkInventoryAdvanced(tx))) throw new ImportError("Pembelian memerlukan inventory_advanced.", 403, "PLAN_LIMIT");
      const outletId = String(batch.outlet_id ?? "");
      const [outlet] = await tx.execute(sql`select id from public.outlets where id=${outletId} and company_id=${input.companyId} for share`);
      if (!outlet) throw new ImportError("Outlet pembelian tidak ditemukan.", 409);
      const ingredients = await tx.execute(sql`select id,code,unit,is_active from public.ingredients where company_id=${input.companyId} and outlet_id=${outletId} order by id for update`) as IngredientRecord[];
      const byCode = new Map(ingredients.map(row => [key(row.code), row]));
      const lines = rows.filter(row => rowKind(row) === "purchase_line");
      const references = new Set<string>();
      for (const header of mains) {
        const p = header.payload, reference = key(required(p.code, "kode_pembelian", header));
        if (!/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(reference) || references.has(reference)) invalid(header, "kode_pembelian", "kode tidak valid/duplikat");
        references.add(reference);
        const date = required(p.date, "tanggal", header);
        const local = date.slice(0, 10), utc = new Date(`${local}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}T00:00:00\+07:00$/.test(date) || !Number.isFinite(utc.getTime()) || utc.toISOString().slice(0,10) !== local) invalid(header, "tanggal", "tanggal kalender WIB tidak valid");
        for (const field of ["supplier", "note"]) if (typeof p[field] !== "string" || String(p[field]).length > 1000) invalid(header, field, "maksimal 1000 karakter");
        const details = lines.filter(line => key(line.payload.purchase_code) === reference);
        if (!details.length || details.length > 100) invalid(header, "kode_pembelian", "wajib 1–100 detail berbeda");
        const seen = new Set<string>();
        const items = details.map(line => {
          const ingredient = byCode.get(key(line.payload.ingredient_code));
          if (!ingredient?.is_active) invalid(line, "kode_bahan", "bahan aktif tidak ditemukan pada outlet tujuan");
          if (ingredient.unit !== line.payload.unit) invalid(line, "satuan", `satuan harus tepat ${ingredient.unit}; tanpa konversi`);
          if (seen.has(ingredient.id)) invalid(line, "kode_bahan", "bahan duplikat dalam pembelian"); seen.add(ingredient.id);
          return { ingredient_id: ingredient.id, quantity: amount(line.payload.quantity, "jumlah", true, line), unit_cost: amount(line.payload.unit_cost, "biaya_per_satuan(Rp)", false, line) };
        });
        const hash = importPurchaseHash(header, lines);
        const [previous] = await tx.execute(sql`select payload_hash,purchase_id from app_private.import_purchase_references
          where company_id=${input.companyId} and outlet_id=${outletId} and reference=${reference} for update`);
        if (previous) {
          if (previous.payload_hash !== hash) invalid(header, "kode_pembelian", "kode pernah dicatat dengan isi berbeda; gunakan kode baru");
          skipped++; purchaseResults.push({ reference, id: previous.purchase_id, replayed: true }); continue;
        }
        let purchase;
        try { purchase = await input.recordPurchase(tx, { companyId: input.companyId, outletId, ownerId: input.ownerId, userId: null,
          supplier: String(p.supplier), note: String(p.note), date, items }); } catch (error) { fromInventory(error); }
        await tx.execute(sql`insert into app_private.import_purchase_references(company_id,outlet_id,reference,payload_hash,purchase_id,batch_id,created_by_owner_id)
          values (${input.companyId},${outletId},${reference},${hash},${purchase.id},${batch.id},${input.ownerId})`);
        created++; purchaseResults.push({ reference, id: purchase.id, replayed: false, total_amount: purchase.total_amount });
      }
      for (const line of lines) if (!references.has(key(line.payload.purchase_code))) invalid(line, "kode_pembelian", "header pembelian tidak ditemukan");
    } else if (domain === "ingredients") {
      const outletId = String(batch.outlet_id ?? "");
      const [outlet] = await tx.execute(sql`select id from public.outlets where id=${outletId} and company_id=${input.companyId} for share`);
      if (!outlet) throw new ImportError("Outlet import bahan tidak ditemukan.", 409);
      const current = await tx.execute(sql`select id,code from public.ingredients where company_id=${input.companyId} and outlet_id=${outletId} for update`) as IngredientRecord[];
      const byCode = new Map(current.map(row => [key(row.code), String(row.id)]));
      const newRows = mains.filter(row => !byCode.has(key(row.payload.code)));
      if (newRows.length && !(await input.checkQuota(tx, "ingredients", newRows.length))) throw new ImportError("Kuota bahan baku sudah penuh. Tingkatkan paket atau lewati kode existing.", 403, "PLAN_LIMIT");
      for (const row of mains) {
        const payload = row.payload, code = required(payload.code, "kode_bahan", row), normalized = key(code);
        const existingId = byCode.get(normalized);
        if (existingId && mode === "skip") { skipped++; continue; }
        const common = { code, name: required(payload.name, "nama", row), unit: required(payload.unit, "satuan", row),
          stock_quantity: amount(payload.stock_quantity, "stok_awal", false, row),
          cost_per_unit: amount(payload.cost_per_unit, "biaya_per_satuan(Rp)", false, row),
          min_stock_alert: amount(payload.min_stock_alert, "stok_minimum", false, row) };
        if (existingId) {
          try { await updateOwnerIngredient(tx, { companyId: input.companyId, outletId, ownerId: input.ownerId! }, existingId,
            { code, name: common.name, unit: common.unit, cost_per_unit: common.cost_per_unit, min_stock_alert: common.min_stock_alert }); }
          catch (error) { fromInventory(error); }
          updated++;
        } else {
          if (!input.ownerId) throw new ImportError("Sesi Owner dibutuhkan untuk mencatat stok pembukaan.", 403);
          try { await createOwnerIngredient(tx, { companyId: input.companyId, outletId, ownerId: input.ownerId }, common); }
          catch (error) { fromInventory(error); }
          byCode.set(normalized, "created"); created++;
        }
      }
    } else if (domain === "products") {
      const outletId = String(batch.outlet_id ?? "");
      const [outlet] = await tx.execute(sql`select id from public.outlets where id=${outletId} and company_id=${input.companyId} for share`);
      if (!outlet) throw new ImportError("Outlet import produk tidak ditemukan.", 409);
      const tiers = await tx.execute(sql`select id,name,slug from public.pricing_tiers where company_id=${input.companyId} and outlet_id=${outletId} and is_active=true order by sort_order,id for share`);
      if (Number(batch.schema_version) === 2) {
        const meta = batch.context?.metadata;
        if (!meta || meta.company_id !== input.companyId || meta.outlet_id !== outletId || !Array.isArray(meta.tiers) || meta.tiers.length !== tiers.length
          || meta.tiers.some((tier: Row) => !tiers.some(now => now.id === tier.id && now.name === tier.name && now.slug === tier.slug && tier.header === `harga_tier:${now.slug}`))) {
          throw new ImportError("Konfigurasi tier berubah atau metadata outlet tidak sesuai. Unduh template terbaru dan validasi ulang; harga tidak dipetakan ulang.",409,"IMPORT_TIERS_STALE");
        }
      }
      const [products, ingredients, categoryRows] = await Promise.all([
        tx.execute(sql`select id,code,name,category_id from public.products where company_id=${input.companyId} and outlet_id=${outletId} for update`) as Promise<unknown>,
        tx.execute(sql`select id,code,name,unit,is_active from public.ingredients where company_id=${input.companyId} and outlet_id=${outletId} for share`) as Promise<unknown>,
        tx.execute(sql`select id,name,sort_order from public.categories where company_id=${input.companyId} and outlet_id=${outletId} for update`),
      ]) as [ProductRecord[], IngredientRecord[], Row[]];
      const productsByCode = new Map(products.filter(row => row.code).map(row => [key(row.code), row]));
      const ingredientsByCode = new Map(ingredients.filter(row => row.code && row.is_active).map(row => [key(row.code), row]));
      const productRowsByCode = new Map<string, StagedImportRow>();
      for (const row of mains) {
        const code = key(required(row.payload.code, "kode_produk", row));
        if (productRowsByCode.has(code)) invalid(row, "kode_produk", `kode_produk duplikat ${code}`);
        productRowsByCode.set(code, row);
      }
      const handledRows = mains.filter(row => !(productsByCode.has(key(row.payload.code)) && mode === "skip"));
      const newRows = handledRows.filter(row => !productsByCode.has(key(row.payload.code)));
      if (newRows.length && !(await input.checkQuota(tx, "products", newRows.length))) throw new ImportError("Kuota produk sudah penuh untuk kode baru. Tingkatkan paket atau lewati kode existing.", 403, "PLAN_LIMIT");
      const categories = new Map(categoryRows.map(row => [key(row.name), String(row.id)]));
      const prospectiveCategories = [...new Map(handledRows.map(row => required(row.payload.category_name, "kategori", row))
        .filter(name => !categories.has(key(name))).map(name => [key(name), name])).values()];
      if (prospectiveCategories.length && !input.allowNewCategories) throw new ImportError(`Setujui pembuatan kategori baru: ${prospectiveCategories.join(", ")}.`, 409, "IMPORT_CATEGORY_CONFIRMATION_REQUIRED");
      for (const categoryName of prospectiveCategories) {
        const ensured = await ensureOutletCategory(tx, { companyId: input.companyId, outletId, name: categoryName });
        categories.set(key(categoryName), String(ensured.category.id));
        if (ensured.created) categoriesCreated++;
      }
      const productIds = new Map<string,string>(), skippedCodes = new Set<string>();
      for (const row of mains) {
        const code = required(row.payload.code, "kode_produk", row), normalized = key(code), previous = productsByCode.get(normalized);
        if (previous && mode === "skip") { productIds.set(normalized, String(previous.id)); skippedCodes.add(normalized); skipped++; continue; }
        const name = required(row.payload.name, "nama", row), category = required(row.payload.category_name, "kategori", row);
        const categoryId = categories.get(key(category)); if (!categoryId) invalid(row, "kategori", `kategori ${category} tidak tersedia pada outlet`);
        const price = amount(row.payload.price, "harga", false, row, 99999999.99);
        if (row.payload.description != null && (typeof row.payload.description !== "string" || row.payload.description.length > 5000)) invalid(row,"deskripsi","maksimal 5000 karakter");
        if (previous) {
          checked(await tx.from("products").update({ name, category_id: categoryId, price, description: row.payload.description ? String(row.payload.description) : null })
            .eq("id", previous.id).eq("company_id", input.companyId).eq("outlet_id", outletId));
          productIds.set(normalized, String(previous.id)); updated++;
        } else {
          const inserted = checked(await tx.from("products").insert({ code, name, category_id: categoryId, price,
            description: row.payload.description ? String(row.payload.description) : null, company_id: input.companyId, outlet_id: outletId, is_active: true }).select("id,code,name,category_id").single());
          productIds.set(normalized, String(inserted.id)); productsByCode.set(normalized, inserted); created++;
        }
        const productId = productIds.get(normalized)!;
        if (Array.isArray(row.payload.tier_prices)) {
          if (Number(batch.schema_version) !== 2 || row.payload.tier_prices.length !== tiers.length) invalid(row,"tier_prices","metadata tier tidak sesuai");
          const existing = checked(await tx.from("product_tier_prices").select("tier_id,price").eq("product_id", productId));
          // replaceProductTierPrices replaces ALL rows. Merge first so blank/omitted prices,
          // including inactive historical tiers, survive. New blank tiers use base-price fallback.
          const merged = new Map<string,number>(existing.map((item: Row) => [String(item.tier_id), Number(item.price)]));
          const seen = new Set<string>();
          for (const item of row.payload.tier_prices) {
            if (!item || seen.has(item.id) || !tiers.some(tier => tier.id === item.id)) invalid(row,"tier_prices","tier tidak aktif/duplikat pada outlet");
            seen.add(item.id);
            if (item.price !== null) { merged.set(item.id, amount(item.price,item.header,false,row,99999999.99)); tierPricesSaved++; }
          }
          await replaceProductTierPrices(tx,input.companyId,productId,[...merged].map(([tier_id,price]) => ({tier_id,price})));
        }
        if (row.payload.image_reference) {
          const [asset] = await tx.execute(sql`select id,provider_file_id,provider_url from app_private.import_assets where id=${row.payload.image_asset_id ?? null}
            and batch_id=${batch.id} and company_id=${input.companyId} and outlet_id=${outletId} and state in ('uploaded','attached') for update`);
          if (!asset?.provider_file_id || !asset.provider_url) invalid(row,"gambar","gambar staging belum siap; ulangi konfirmasi");
          checked(await tx.from("products").update({image_url:asset.provider_url,image_silo_id:asset.provider_file_id}).eq("id",productId).eq("company_id",input.companyId).eq("outlet_id",outletId));
          await tx.execute(sql`update app_private.import_assets set state='attached',processed_base64=null,updated_at=now() where id=${asset.id}`);
          imagesAttached++;
        }
      }
      const groupedRecipes = new Map<string,{productId:string; recipeRows:StagedImportRow[]; lines:{product_id:string;ingredient_id:string;quantity_used:number}[]}>();
      for (const row of recipes) {
        const productCode = required(row.payload.product_code, "kode_produk", row), ingredientCode = required(row.payload.ingredient_code, "kode_bahan", row);
        const productKey = key(productCode), ingredient = ingredientsByCode.get(key(ingredientCode));
        if (!ingredient) invalid(row, "kode_bahan", `kode bahan ${ingredientCode} tidak ditemukan/aktif pada outlet tujuan; import bahan terlebih dahulu`);
        if (skippedCodes.has(productKey)) { skipped++; continue; }
        if (!productRowsByCode.has(productKey) && productsByCode.has(productKey) && mode === "skip") { skipped++; continue; }
        const productId = productIds.get(productKey) ?? (mode === "update" ? productsByCode.get(productKey)?.id : undefined);
        if (!productId) invalid(row, "kode_produk", `kode produk ${productCode} tidak ditemukan pada outlet tujuan`);
        const group = groupedRecipes.get(productKey) ?? { productId: String(productId), recipeRows: [], lines: [] };
        if (group.lines.some(line => line.ingredient_id === ingredient.id)) invalid(row, "kode_bahan", "pasangan kode_produk + kode_bahan duplikat");
        group.recipeRows.push(row);
        group.lines.push({ product_id: String(productId), ingredient_id: String(ingredient.id), quantity_used: amount(row.payload.quantity_used, "jumlah_per_porsi", true, row) });
        groupedRecipes.set(productKey, group);
      }
      for (const group of groupedRecipes.values()) {
        checked(await tx.from("product_recipes").delete().eq("product_id", group.productId));
        if (group.lines.length) checked(await tx.from("product_recipes").insert(group.lines));
        recipesSaved += group.lines.length;
      }
    } else {
      const roles = await tx.execute(sql`select id,name from public.roles where company_id=${input.companyId} for share`);
      const outlets = await tx.execute(sql`select id,name from public.outlets where company_id=${input.companyId} for share`);
      const users = await tx.execute(sql`select id,username from public.users where company_id=${input.companyId}`);
      const existingUsers = new Map(users.map(row => [key(row.username), row]));
      const roleMap = new Map(roles.map(row => [key(row.name), String(row.id)]));
      const outletMap = new Map(outlets.map(row => [key(row.name), String(row.id)]));
      const newRows = mains.filter(row => !existingUsers.has(key(row.payload.username)));
      if (newRows.length && !(await input.checkQuota(tx,"employees",newRows.length))) throw new ImportError("Kuota karyawan paket sudah penuh.",403,"PLAN_LIMIT");
      for (const row of mains) {
        const name = required(row.payload.name,"nama",row), username = required(row.payload.username,"username",row).toLowerCase();
        const employee = existingUsers.get(key(username));
        if (employee && mode === "skip") { skipped++; continue; }
        const roleId = roleMap.get(key(row.payload.role_name)); if (!roleId) invalid(row,"role","role tidak ditemukan");
        const names = Array.isArray(row.payload.outlet_names) ? row.payload.outlet_names : [], all = names.includes("__ALL__");
        if (!all && names.some(value=>!outletMap.has(key(value)))) invalid(row,"outlets","outlet tidak ditemukan");
        const outletIds = all ? [] : names.map(value=>outletMap.get(key(value))).filter(Boolean) as string[];
        if (!all && !outletIds.length) invalid(row,"outlets","pilih minimal satu outlet");
        const values = { companyId: input.companyId, employeeId: employee ? String(employee.id) : undefined, name, username, roleId,
          allOutlets: all, outletIds, pinHash: required(row.payload.pin_hash,"pin_hash",row) };
        try { await saveEmployee(tx,values); }
        catch (error) { throw new ImportError(error instanceof Error?error.message:"Gagal menyimpan karyawan",409,"IMPORT_REFERENCE_INVALID"); }
        if (employee) updated++; else created++;
      }
    }
    const imported = created + updated;
    const result = { imported, created, updated, skipped, recipes: recipesSaved, categories_created: categoriesCreated,
      tier_prices: tierPricesSaved, images: imagesAttached, purchases: purchaseResults, replayed: false };
    await tx.execute(sql`update app_private.import_batches set status='confirmed',confirmed_at=now(),imported_rows=${imported},
      confirmation_options=${JSON.stringify({conflict_mode:mode,allow_new_categories:input.allowNewCategories === true})}::jsonb,
      confirmation_result=${JSON.stringify(result)}::jsonb,confirmed_by_owner_id=${input.ownerId ?? null} where id=${batch.id}`);
    await tx.execute(sql`update app_private.import_rows set payload=payload-'pin'-'pin_hash' where batch_id=${batch.id}`);
    return result;
  });
}
