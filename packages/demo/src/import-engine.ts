import type { DemoState } from "./models";
import type { NewId } from "./entities";
import { saveEntity } from "./entities";
import { auditActorId, requireOwner, scope } from "./access";
import { clone, decimal, find, list, record } from "./business";
import { assertDemoImportMetadata, DemoImportError, demoPurchaseSignature, importKey, importKind, importRowKind,
  type DemoImportBatch, type DemoImportBook, type DemoImportCommand, type DemoImportIdentities, type DemoImportResult } from "./import-models";

const invalid = (message: string): never => { throw new DemoImportError(message, 409, "IMPORT_REFERENCE_INVALID"); };
/** Reuse the same catalog validation as interactive edits, including decimal tier prices. */
function saveImportProduct(state: DemoState, input: Record<string, unknown>, nextId: NewId, images: ReadonlySet<string>) {
  const saved = record(saveEntity(state, "products", input, nextId, images));
  return find(state.products, saved.id);
}
export const publicImportPayload = (payload: Record<string, unknown>) => Object.fromEntries(Object.entries(payload).filter(([key]) => !["pin", "pin_hash"].includes(key)));
export function publicImportBatch(batch: DemoImportBatch, state: DemoState, detail = false) {
  const { rows: _rows, assets: _assets, context, ...view } = batch;
  return { ...clone(view), outlet_name: detail ? state.outlets.find(row => row.id === batch.outlet_id)?.name ?? null : null,
    ...(detail ? { context: clone(context) } : {}) };
}
export function executeDemoImport(state: DemoState, book: DemoImportBook, command: DemoImportCommand, nextId: NewId, images: ReadonlySet<string>,
  identities: DemoImportIdentities): unknown {
  requireOwner(state);
  if (command.type === "import.stage") {
    const batch = clone(command.batch);
    if (batch.outlet_id) scope(state, batch.outlet_id);
    if (book.batches.some(row => row.id === batch.id) || batch.created_by_owner_id !== auditActorId(state)) invalid("Scope batch import tidak valid.");
    book.batches.push(batch); return { batch_id: batch.id };
  }
  if (command.type === "import.cleanup") {
    let batches = 0, delete_attempts = 0;
    for (const batch of book.batches) if (batch.status === "validated" && batch.expires_at <= state.now) {
      batches++; batch.status = "failed";
      for (const row of batch.rows) { delete row.payload.pin; delete row.payload.pin_hash; }
      for (const asset of batch.assets) if (asset.state !== "attached" && asset.state !== "deleted") { asset.state = "deleted"; delete_attempts++; }
    }
    return { batches, delete_attempts };
  }
  const batch = book.batches.find(row => row.id === command.batch_id);
  if (!batch) throw new DemoImportError("Batch tidak ditemukan.", 404);
  if (batch.created_by_owner_id !== auditActorId(state)) throw new DemoImportError("Owner batch tidak sesuai sesi.", 403);
  if (batch.status === "confirmed") return { ...batch.confirmation_result!, replayed: true };
  if (command.image_urls) for (const asset of batch.assets) if (command.image_urls[asset.id]) {
    if (!images.has(command.image_urls[asset.id])) invalid("Gambar harus dimiliki sandbox aktif.");
    asset.url = command.image_urls[asset.id]; asset.state = "staged";
  }
  if (batch.expires_at <= state.now) throw new DemoImportError("Preview import kedaluwarsa. Unggah dan validasi ulang.", 409, "IMPORT_EXPIRED");
  if (batch.status !== "validated") throw new DemoImportError("Batch tidak dapat diproses. Validasi file kembali.", 409);
  const mode = command.conflict_mode;
  if (!["skip", "update"].includes(mode) || typeof command.allow_new_categories !== "boolean") throw new DemoImportError("Pilihan konfirmasi tidak valid.");
  const domain = batch.domain, outletId = batch.outlet_id;
  if (outletId) scope(state, outletId);
  if (batch.context.linked && batch.rows.some(row => row.errors.length)) throw new DemoImportError("Ada baris error pada workbook terkait. Perbaiki semua sheet/baris lalu unggah ulang.", 409, "IMPORT_LINKED_ERRORS");
  if (domain === "products" && batch.schema_version === 2) assertDemoImportMetadata(state, outletId!, batch.context.metadata, identities);
  const rows = batch.rows.filter(row => !row.errors.length), mains = rows.filter(row => importRowKind(row, domain) === importKind(domain));
  const recipes = rows.filter(row => row.payload.kind === "recipe");
  if (!mains.length && !(domain === "products" && recipes.length)) throw new DemoImportError("Tidak ada baris utama yang dapat diproses.");
  const result: DemoImportResult = { imported: 0, created: 0, updated: 0, skipped: 0, recipes: 0, categories_created: 0, tier_prices: 0, images: 0, purchases: [], replayed: false };
  if (domain === "purchases") {
    if (!state.plans.find(row => row.slug === state.plan)!.features.inventory_advanced) throw new DemoImportError("Pembelian memerlukan inventory_advanced.", 403, "PLAN_LIMIT");
    for (const row of mains) {
      const p = row.payload, signature = demoPurchaseSignature(row, rows), reference = String(p.code).toLocaleUpperCase("id-ID");
      const details = rows.filter(line => line.payload.kind === "purchase_line" && importKey(line.payload.purchase_code) === importKey(p.code));
      const items = details.map(line => {
        const ingredient = state.ingredients.find(item => item.outlet_id === outletId && importKey(item.code) === importKey(line.payload.ingredient_code));
        if (!ingredient?.is_active || ingredient.unit !== line.payload.unit) return invalid("Bahan pembelian tidak aktif/tidak ditemukan atau satuan berubah; validasi ulang.");
        return { ingredient_id: ingredient.id, quantity: decimal(line.payload.quantity,"purchase quantity",0.01), unit_cost: decimal(line.payload.unit_cost,"purchase cost") };
      });
      const previous = book.references.find(item => item.outlet_id === outletId && item.reference === reference);
      if (previous) {
        if (previous.signature !== signature) invalid("Kode pembelian pernah dicatat dengan isi berbeda; gunakan kode baru.");
        result.skipped++; result.purchases.push({ reference, id: previous.purchase_id, replayed: true }); continue;
      }
      // Import dates are date-only midnight WIB, including historical/future dates accepted
      // by the workbook contract. Header order determines the final ingredient unit cost.
      const id = nextId("purchase"), purchaseItems = items.map(item => ({ ...item, id: nextId("purchase-item"), purchase_id: id,
        subtotal: Number((BigInt(Math.round(item.quantity * 100)) * BigInt(Math.round(item.unit_cost * 100)) + BigInt(50)) / BigInt(100)) / 100 }));
      const total_amount = Number(purchaseItems.reduce((sum, item) => sum + BigInt(Math.round(item.subtotal * 100)), BigInt(0))) / 100;
      if(!Number.isFinite(total_amount)||total_amount>999999999999.99||purchaseItems.some(item=>item.subtotal>999999999999.99))invalid("Nilai pembelian melampaui batas nominal.");
      const purchase = { id, company_id: state.company.id, outlet_id: outletId!, supplier_name: String(p.supplier), note: String(p.note), purchase_date: String(p.date), total_amount,
        items: purchaseItems, created_by: auditActorId(state), created_at: state.now };
      state.purchases.push(purchase);
      for (const item of purchaseItems) {
        const ingredient = find(state.ingredients, item.ingredient_id);
        const nextStock = Math.round((ingredient.stock_quantity + item.quantity) * 100) / 100;
        if(!Number.isFinite(nextStock)||Math.abs(nextStock)>9999999999.99)invalid("Stok setelah pembelian melampaui batas.");
        ingredient.stock_quantity = nextStock; ingredient.cost_per_unit = item.unit_cost; ingredient.updated_at = state.now;
        state.movements.push({ id: nextId("movement"), company_id: state.company.id, outlet_id: outletId!, ingredient_id: ingredient.id, type: "purchase", quantity_change: item.quantity,
          reference_id: id, note: String(p.note) || null, created_by: auditActorId(state), created_at: state.now });
      }
      book.references.push({ outlet_id: outletId!, reference, signature, purchase_id: String(purchase.id) });
      result.created++; result.purchases.push({ reference, id: String(purchase.id), replayed: false, total_amount: Number(purchase.total_amount) });
    }
  } else if (domain === "ingredients") {
    for (const row of mains) {
      const p = row.payload, previous = state.ingredients.find(item => item.outlet_id === outletId && importKey(item.code) === importKey(p.code));
      if (previous && mode === "skip") { result.skipped++; continue; }
      saveEntity(state, "ingredients", { ...(previous ? { id: previous.id } : {}), outlet_id: outletId, code: p.code, name: p.name, unit: p.unit,
        stock_quantity: previous?.stock_quantity ?? p.stock_quantity, cost_per_unit: p.cost_per_unit, min_stock_alert: p.min_stock_alert }, nextId, images);
      if (previous) result.updated++; else result.created++;
    }
  } else if (domain === "products") {
    const skipped = new Set<string>();
    for (const row of mains) {
      const p = row.payload, previous = state.products.find(item => item.outlet_id === outletId && importKey(item.code) === importKey(p.code));
      if (previous && mode === "skip") { result.skipped++; skipped.add(importKey(p.code)); continue; }
      let category = state.categories.find(item => item.outlet_id === outletId && importKey(item.name) === importKey(p.category_name));
      if (!category) {
        if (!command.allow_new_categories) throw new DemoImportError(`Setujui pembuatan kategori baru: ${p.category_name}.`, 409, "IMPORT_CATEGORY_CONFIRMATION_REQUIRED");
        const saved = record(saveEntity(state, "categories", { outlet_id: outletId, name: p.category_name }, nextId, images));
        category = find(state.categories, saved.id); result.categories_created++;
      }
      const prices = { ...previous?.prices };
      if (Array.isArray(p.tier_prices)) for (const raw of p.tier_prices) {
        const item = record(raw), tier = state.tiers.find(tier => tier.outlet_id === outletId && tier.is_active && identities.id(state.generation, "tier", tier.id) === item.id);
        if (!tier) invalid("Tier tidak aktif/tidak ditemukan; validasi ulang.");
        if (item.price !== null) { prices[tier!.id] = Number(item.price); result.tier_prices++; }
      }
      const asset = p.image_reference ? batch.assets.find(asset => asset.id === p.image_asset_id && images.has(asset.url)) : undefined;
      if (p.image_reference && !asset) invalid("Gambar staging belum siap; validasi ulang.");
      saveImportProduct(state, { ...(previous ? { id: previous.id } : {}), outlet_id: outletId, code: p.code, name: p.name, category_id: category.id,
        price: p.price, description: p.description, prices, ...(asset ? { image_url: asset.url } : {}) }, nextId, images);
      if (asset) { asset.state = "attached"; result.images++; }
      if (previous) result.updated++; else result.created++;
    }
    const grouped = new Map<string, { ingredient_id: string; quantity_used: number }[]>();
    for (const row of recipes) {
      const p = row.payload, code = importKey(p.product_code);
      const ingredient = state.ingredients.find(item => item.outlet_id === outletId && importKey(item.code) === importKey(p.ingredient_code));
      if (!ingredient?.is_active) invalid("Bahan komposisi tidak aktif/tidak ditemukan; validasi ulang.");
      if (skipped.has(code) || mode === "skip" && !mains.some(main => importKey(main.payload.code) === code)) { result.skipped++; continue; }
      const lines = grouped.get(code) ?? []; lines.push({ ingredient_id: ingredient!.id, quantity_used: Number(p.quantity_used) }); grouped.set(code, lines);
    }
    for (const [code, recipe] of grouped) {
      const product = state.products.find(item => item.outlet_id === outletId && importKey(item.code) === code);
      if (!product) invalid("Produk komposisi tidak ditemukan; validasi ulang.");
      saveImportProduct(state, { id: product!.id, recipe }, nextId, images); result.recipes += recipe.length;
    }
  } else {
    for (const row of mains) {
      const p = row.payload, previous = state.employees.find(item => importKey(item.username) === importKey(p.username));
      if (previous && mode === "skip") { result.skipped++; continue; }
      const role = state.roles.find(item => importKey(item.name) === importKey(p.role_name));
      if (!role) invalid("Role tidak ditemukan; validasi ulang.");
      const names = list(p.outlet_names), all = names.includes("__ALL__"), outlet_ids = all ? [] : names.map(name => {
        const outlet = state.outlets.find(item => importKey(item.name) === importKey(name));
        if (!outlet) return invalid("Outlet karyawan tidak ditemukan; validasi ulang."); return outlet.id;
      });
      const employee = record(saveEntity(state, "employees", { ...(previous ? { id: previous.id } : {}), name: p.name, username: p.username,
        role_id: role!.id, pin: p.pin, all_outlets: all, outlet_ids }, nextId, images));
      if (!book.secretEmployeeIds.includes(String(employee.id))) book.secretEmployeeIds.push(String(employee.id));
      if (previous) result.updated++; else result.created++;
    }
  }
  result.imported = result.created + result.updated;
  batch.status = "confirmed"; batch.imported_rows = result.imported; batch.confirmed_at = state.now; batch.confirmed_by_owner_id = auditActorId(state);
  batch.confirmation_options = { conflict_mode: mode, allow_new_categories: command.allow_new_categories };
  batch.confirmation_result = result;
  for (const row of batch.rows) { delete row.payload.pin; delete row.payload.pin_hash; }
  for (const asset of batch.assets) if (asset.state !== "attached") asset.state = "deleted";
  return result;
}
