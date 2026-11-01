import type { DemoSandbox } from "../engine";
import type { DemoState } from "../models";
import { clone, jakartaDate } from "../business";
import { publicImportPayload } from "../import-engine";
import { assertDemoImportMetadata, DemoImportError, importKey, importKind, importMetadata, importRowKind, importTiers,
  type DemoImageSummary, type DemoImportAsset, type DemoImportBatch, type DemoImportContext, type DemoImportDomain,
  type DemoImportMetadata, type DemoImportRow, type DemoWorkbookService } from "../import-models";

export interface DemoImportRequest {
  path: string; method: string; query: URLSearchParams; body: Record<string, unknown>; form: FormData | null;
  /** Must be checked after every async boundary and immediately before a mutation. */
  active(): void;
}
export interface DemoLocalResponse { data?: unknown; status?: number; binary?: Uint8Array; headers?: Record<string, string> }
export interface DemoImportService { dispatch(request: DemoImportRequest): Promise<DemoLocalResponse>; destroy(): void }
export interface DemoImportDependencies {
  loadWorkbook(): Promise<DemoWorkbookService>;
  prepareImages?(file: File | null, rows: DemoImportRow[], active: () => void): Promise<{
    assets: { reference: string; file: File; width: number; height: number; content_hash: string }[]; summary: DemoImageSummary;
  }>;
}
export const isDemoImportPath = (path: string) => /^\/api\/owner\/import(?:\/|$)/.test(path);
const domains = ["products", "ingredients", "employees", "purchases"] as const;
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function bad(message: string, status = 400, code = "IMPORT_INVALID"): never { throw new DemoImportError(message, status, code); }
const domainOf = (value: unknown): DemoImportDomain => domains.includes(value as DemoImportDomain) ? value as DemoImportDomain : bad("Domain wajib: products, ingredients, employees, atau purchases.");
const fileLike = (value: unknown): value is File => typeof File !== "undefined" && value instanceof File;
function importScope(sandbox: DemoSandbox, domain: DemoImportDomain, raw: unknown) {
  const state = sandbox.getSnapshot();
  if (!state.session.authenticated) bad("Sesi berakhir", 401);
  if (state.session.mode !== "owner") bad("Owner access required", 403);
  if (domain === "purchases" && !state.plans.find(row => row.slug === state.plan)!.features.inventory_advanced) bad("Pembelian memerlukan inventory_advanced.", 403, "PLAN_LIMIT");
  const outlet = domain === "employees" ? null : state.outlets.find(row => row.id === raw && row.is_active);
  if (domain !== "employees" && !outlet) bad("Pilih outlet aktif yang valid.");
  return { state, outletId: outlet?.id ?? null };
}
function contextFor(sandbox: DemoSandbox, state: DemoState, outletId: string | null, metadata?: DemoImportMetadata): DemoImportContext {
  const products = state.products.filter(row => row.outlet_id === outletId), ingredients = state.ingredients.filter(row => row.outlet_id === outletId);
  return {
    existingProductCodes: new Map(products.filter(row => row.code).map(row => [importKey(row.code), { ...row, code: row.code! }])),
    existingProductNames: new Set(products.map(row => importKey(row.name))),
    existingIngredientCodes: new Map(ingredients.filter(row => row.code).map(row => [importKey(row.code), { ...row, code: row.code! }])),
    existingCategories: new Map(state.categories.filter(row => row.outlet_id === outletId).map(row => [importKey(row.name), row])),
    existingUsernames: new Set(state.employees.map(row => importKey(row.username))),
    roleNameMap: new Map(state.roles.map(row => [importKey(row.name), row])), outletNameMap: new Map(state.outlets.map(row => [importKey(row.name), row])),
    ...(outletId ? { companyId: sandbox.importIdentities.id(state.generation, "company", state.company.id),
      outletId: sandbox.importIdentities.id(state.generation, "outlet", outletId), tiers: importTiers(state, outletId, sandbox.importIdentities), metadata,
      existingTierPrices: new Map(products.flatMap(product => Object.entries(product.prices).map(([tier, price]) => [`${product.id}:${sandbox.importIdentities.id(state.generation, "tier", tier)}`, price]))) } : {}),
  };
}
function sampleSheets(state: DemoState, domain: DemoImportDomain, outletId: string | null, metadata?: DemoImportMetadata): Record<string, unknown[][]> {
  const ingredient = state.ingredients.find(row => row.outlet_id === outletId && row.is_active && row.code);
  if (domain === "products") return { Produk: [["DEMO-IMPORT-01", "Kopi Contoh Import", state.categories.find(row => row.outlet_id === outletId)?.name ?? "Menu Contoh", 25000,
    "Data contoh lokal; dapat diubah sebelum diunggah.", ...(metadata ? [...metadata.tiers.map((_tier, index) => index < 2 ? null : 30000), ""] : [])]],
    Komposisi: ingredient ? [["DEMO-IMPORT-01", ingredient.code, 2]] : [] };
  if (domain === "ingredients") return { "Bahan Baku": [["DEMO-BAHAN-01", "Bahan Contoh Import", "gram", 1000, 125, 100], ["DEMO-BAHAN-02", "Susu Contoh Import", "ml", 2000, 25, 200]] };
  if (domain === "purchases") {
    if (!ingredient) bad("Import bahan aktif berkode terlebih dahulu untuk mengunduh contoh pembelian.");
    return { Pembelian: [["DEMO-BELI-01", jakartaDate(state.now), "Pemasok Contoh A", "Pembelian lokal pertama"], ["DEMO-BELI-02", jakartaDate(state.now), "Pemasok Contoh B", "Pembelian lokal kedua"]],
      "Detail Pembelian": [["DEMO-BELI-01", ingredient.code, 10, ingredient.unit, 100], ["DEMO-BELI-02", ingredient.code, 20, ingredient.unit, 150]] };
  }
  return { Karyawan: [["Karyawan Contoh Import", "contoh_import", "567890", state.roles[0]?.name ?? "Kasir", "Semua"]] };
}
/** Stateless facade over a generation-owned sandbox repository. No transport fallback exists. */
export function createDemoImportService(sandbox: DemoSandbox, dependencies: DemoImportDependencies): DemoImportService {
  const generation = sandbox.generation, urls = new Set<string>();
  const stagedImages = new Map<string, { files: { id: string; file: File }[]; urls: string[]; expires_at: string; retry: boolean }>();
  let destroyed = false, workbook: Promise<DemoWorkbookService> | undefined;
  const alive = (request: DemoImportRequest) => {
    request.active();
    if (destroyed || sandbox.generation !== generation) throw new DOMException("Demo import scope ended", "AbortError");
    sandbox.getSnapshot();
  };
  const load = async (request: DemoImportRequest) => { workbook ??= dependencies.loadWorkbook().catch(error => { workbook = undefined; throw error; }); const service = await workbook; alive(request); return service; };
  const cleanup = (request: DemoImportRequest) => {
    alive(request); const result = sandbox.run({ type: "import.cleanup" }, generation);
    for (const [id, staged] of stagedImages) if (staged.expires_at <= sandbox.getSnapshot().now) {
      for (const url of staged.urls) { sandbox.removeImage(url); urls.delete(url); } stagedImages.delete(id);
    }
    return result;
  };
  return {
    async dispatch(request) {
      alive(request);
      const { path, method, query, body, form } = request;
      const session = sandbox.getSnapshot().session;
      if (!session.authenticated) bad("Sesi berakhir", 401);
      if (session.mode !== "owner") bad("Owner access required", 403);
      const action = path.slice("/api/owner/import/".length);
      if (!["template", "validate", "confirm", "batches", "cleanup"].includes(action)) bad("Local demo endpoint not found", 404);
      if (method !== (["template", "batches"].includes(action) ? "GET" : "POST")) bad("Method not allowed", 405);
      if (action === "batches") {
        if (query.has("domain")) domainOf(query.get("domain"));
        if (query.has("batch_id") && !uuid.test(query.get("batch_id")!)) bad("batch_id tidak valid");
        const result = sandbox.getImportHistory(Object.fromEntries(["batch_id", "domain", "outlet_id"].filter(key => query.has(key)).map(key => [key, query.get(key)!])));
        if (!result) bad("Batch tidak ditemukan", 404);
        return { data: result };
      }
      if (action === "cleanup") return { data: cleanup(request) };
      if (action === "confirm") {
        if (typeof body.batch_id !== "string" || !uuid.test(body.batch_id)) bad("batch_id tidak valid");
        const mode = body.conflict_mode ?? "skip";
        if (mode !== "skip" && mode !== "update") bad("Pilih Lewati atau Perbarui untuk kode yang sudah tersedia.");
        if (typeof body.allow_new_categories !== "boolean") bad("Konfirmasi kategori baru wajib diberikan.");
        alive(request);
        const staged = stagedImages.get(body.batch_id), image_urls: Record<string, string> = {};
        try {
          if (staged?.retry) for (const asset of staged.files) {
            alive(request); const url = sandbox.attachImage(asset.file); staged.urls.push(url); urls.add(url); image_urls[asset.id] = url;
          }
          alive(request);
          const result = sandbox.run({ type: "import.confirm", batch_id: body.batch_id, conflict_mode: mode, allow_new_categories: body.allow_new_categories,
            ...(Object.keys(image_urls).length ? { image_urls } : {}) }, generation);
          if (staged) { for (const url of staged.urls) sandbox.removeImage(url); stagedImages.delete(body.batch_id); }
          return { data: result };
        } catch (error) {
          if (staged) { for (const url of staged.urls) { try { sandbox.removeImage(url); } catch { /* disposed sandbox owns final cleanup */ } urls.delete(url); } staged.urls = []; staged.retry = true; }
          throw error;
        }
      }
      const domain = domainOf(action === "template" ? query.get("domain") : form?.get("domain"));
      const rawOutlet = action === "template" ? query.get("outlet_id") : form?.get("outlet_id");
      let { state, outletId } = importScope(sandbox, domain, rawOutlet);
      const excel = await load(request);
      ({ state, outletId } = importScope(sandbox, domain, rawOutlet));
      if (action === "template") {
        if (query.has("version") && !["1", "2"].includes(query.get("version")!)) bad("version harus 1 atau 2.");
        const metadata = domain === "products" && query.get("version") !== "1" ? importMetadata(state, outletId!, sandbox.importIdentities) : undefined;
        if ((metadata?.tiers.length ?? 0) > 100) bad("Maksimal 100 tier aktif.");
        let bytes = await excel.buildTemplateWorkbook(domain, state.categories.filter(row => row.outlet_id === outletId).map(row => row.name), metadata);
        alive(request);
        if (query.get("sample") === "1") {
          if (!excel.fillSample) bad("Contoh workbook belum dikonfigurasi.", 501);
          bytes = await excel.fillSample(bytes, sampleSheets(state, domain, outletId, metadata)); alive(request);
        }
        const name = { products: "produk", ingredients: "bahan-baku", employees: "karyawan", purchases: "pembelian" }[domain];
        return { binary: bytes, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${query.get("sample") === "1" ? "contoh" : "template"}-${name}.xlsx"` } };
      }
      const file = form?.get("file");
      if (!fileLike(file) || !file.size) bad("Pilih file Excel (.xlsx) yang berisi data.");
      if (!/\.xlsx$/i.test(file.name)) bad("Format yang didukung adalah .xlsx.");
      if (file.size > 2 * 1024 * 1024) bad("Ukuran file maksimal 2 MB.");
      const bytes = await file.arrayBuffer(); alive(request);
      const parsed = excel.parseWorkbook(bytes, domain);
      if (!parsed.headerOk) return { status: 400, data: { error: parsed.structuralErrors.map(issue => issue.message).join(" "), code: "IMPORT_STRUCTURE_INVALID", structural_errors: parsed.structuralErrors } };
      if (!parsed.rows.length) bad("Tidak ada baris data. Isi data mulai baris kedua.");
      const imageZip = form?.get("images_zip") ?? null;
      if (imageZip !== null && (domain !== "products" || !fileLike(imageZip) || !/\.zip$/i.test(imageZip.name) || !imageZip.size || imageZip.size > 3 * 1024 * 1024)) bad("images_zip hanya untuk produk: ZIP gambar terpisah, maksimal 3 MB.");
      if (file.size + (fileLike(imageZip) ? imageZip.size : 0) > 4 * 1024 * 1024) bad("Total Excel dan ZIP maksimal 4 MB.");
      let imageData: Awaited<ReturnType<NonNullable<DemoImportDependencies["prepareImages"]>>> = { assets: [], summary: { files: 0, matched: 0, unreferenced: 0, rows: 0, processed_bytes: 0 } };
      if (dependencies.prepareImages) imageData = await dependencies.prepareImages(imageZip, parsed.rows, () => alive(request));
      else if (imageZip || parsed.rows.some(row => row.payload.image_reference)) bad("Decoder gambar lokal belum tersedia. Gunakan bridge browser demo untuk ZIP gambar.", 400, "IMPORT_IMAGES_INVALID");
      alive(request);
      ({ state, outletId } = importScope(sandbox, domain, rawOutlet));
      if (domain === "products" && parsed.schemaVersion === 2) assertDemoImportMetadata(state, outletId!, parsed.metadata ?? null, sandbox.importIdentities);
      const context = contextFor(sandbox, state, outletId, parsed.metadata);
      excel.validateRows(domain, parsed.rows, context);
      if (domain === "purchases") for (const row of parsed.rows.filter(row => row.payload.kind === "purchase")) {
        const previous = sandbox.getImportPurchaseReplay(outletId!, row, parsed.rows);
        row.payload.conflict = Boolean(previous); row.payload.purchase_replayed = previous?.identical ?? false; row.payload.existing_id = previous?.id ?? null;
        if (previous) (previous.identical ? row.warnings : row.errors).push({ field: "kode_pembelian", message: previous.identical ? "Pembelian identik sudah dicatat. Selalu dilewati tanpa menambah stok." : "Kode pembelian pernah dicatat dengan isi berbeda; gunakan kode baru." });
      }
      const usage = sandbox.getUsageSummary(), limit = domain === "purchases" ? null : usage.limits[domain];
      const current = domain === "purchases" ? 0 : usage.usage[domain], budget = limit === null || limit < 0 ? null : Math.max(0, limit - current);
      excel.applyPlanBudget(domain, parsed.rows, budget);
      const mains = parsed.rows.filter(row => importRowKind(row, domain) === importKind(domain)), recipes = parsed.rows.filter(row => row.payload.kind === "recipe");
      if (!mains.length && !(domain === "products" && recipes.length)) bad("Isi minimal satu baris data utama.");
      const linked = domain === "purchases" || parsed.schemaVersion === 2 || recipes.length > 0, errors = parsed.rows.filter(row => row.errors.length), eligible = mains.filter(row => !row.errors.length);
      const assets: DemoImportAsset[] = [], attached: string[] = [];
      try {
        for (const asset of imageData.assets) {
          alive(request); const url = sandbox.attachImage(asset.file); attached.push(url);
          assets.push({ id: crypto.randomUUID(), reference: asset.reference, content_hash: asset.content_hash, byte_size: asset.file.size, width: asset.width, height: asset.height, state: "staged", url });
        }
        for (const row of parsed.rows) {
          const asset = assets.find(asset => asset.reference === row.payload.image_reference_normalized);
          if (asset) row.payload.image_asset_id = asset.id;
        }
        const batch: DemoImportBatch = { id: crypto.randomUUID(), domain, outlet_id: outletId, file_name: file.name.slice(0, 255), total_rows: parsed.rows.length,
          valid_rows: parsed.rows.length - errors.length, error_rows: errors.length, imported_rows: 0, status: "validated", schema_version: parsed.schemaVersion,
          created_at: state.now, confirmed_at: null, expires_at: new Date(Date.parse(state.now) + 86400_000).toISOString(), created_by_owner_id: `demo-owner:${generation}`,
          confirmed_by_owner_id: null, confirmation_options: null, confirmation_result: null,
          context: { linked, metadata: parsed.metadata ?? null, structural_errors: parsed.structuralErrors, image_summary: imageData.summary, timezone: domain === "purchases" ? "Asia/Jakarta" : null }, rows: parsed.rows, assets };
        alive(request); sandbox.run({ type: "import.stage", batch }, generation); attached.forEach(url => urls.add(url));
        if (assets.length) stagedImages.set(batch.id, { files: imageData.assets.map(image => ({ id: assets.find(asset => asset.reference === image.reference)!.id, file: image.file })),
          urls: [...attached], expires_at: batch.expires_at, retry: false });
        const validProducts = eligible.filter(row => row.payload.kind === "product");
        const categories = (rows: DemoImportRow[]) => [...new Map(rows.filter(row => row.payload.category_is_new).map(row => [importKey(row.payload.category_name), String(row.payload.category_name)])).values()];
        const conflicts = new Set(parsed.rows.filter(row => row.payload.conflict && !row.errors.length).map(row => String(row.payload.code ?? row.payload.product_code ?? row.payload.username ?? ""))).size;
        return { data: { batch_id: batch.id, schema_version: batch.schema_version, metadata: parsed.metadata ?? null, expires_in_seconds: 86400, expires_at: batch.expires_at,
          assets: assets.map(({ url, ...asset }) => ({ ...asset, preview_url: url })),
          summary: { total: parsed.rows.length, main_total: mains.length, valid: eligible.length, errors: errors.length, warnings: parsed.rows.reduce((sum, row) => sum + row.warnings.length, 0),
            linked_errors: linked ? errors.length : 0, can_confirm: (eligible.length > 0 || domain === "products" && recipes.length > 0) && (!linked || errors.length === 0),
            conflicts, conflict_rows: conflicts, inserted: eligible.filter(row => !row.payload.conflict).length, updated_candidates: domain === "purchases" ? 0 : conflicts,
            skipped_candidates: conflicts, purchase_replays: mains.filter(row => row.payload.purchase_replayed).length,
            new_categories: categories(validProducts), new_categories_for_insert: categories(validProducts.filter(row => !row.payload.conflict)), new_categories_for_update: categories(validProducts.filter(row => row.payload.conflict)),
            recipes: recipes.length, purchase_lines: parsed.rows.filter(row => row.payload.kind === "purchase_line").length, tiers: context.tiers ?? [],
            tier_prices: mains.reduce((sum, row) => sum + (Array.isArray(row.payload.tier_prices) ? row.payload.tier_prices.filter(item => item.price !== null).length : 0), 0),
            images: imageData.summary, existing_ingredients: context.existingIngredientCodes?.size ?? 0, limit_used: budget === null ? null : `${current}/${limit}`,
            limit_note: budget === 0 ? "Kuota penuh untuk kode baru; data berkode sama masih dapat dilewati atau diperbarui." : null,
            max_rows: ["employees", "purchases"].includes(domain) ? 100 : 500, max_recipe_rows: 2000, max_purchase_lines: 10000 },
          rows: parsed.rows.map(row => { const p = row.payload; return { row_number: row.rowNumber, sheet_name: p.sheet_name, sheet_row: p.sheet_row, field: row.errors[0]?.field ?? row.warnings[0]?.field ?? null,
            kind: importRowKind(row, domain), conflict: p.conflict === true, code: String(p.code ?? p.username ?? p.product_code ?? p.purchase_code ?? ""), category_name: String(p.category_name ?? ""),
            name: String(p.name ?? p.username ?? (p.kind === "recipe" ? `${p.product_code} → ${p.ingredient_code}` : p.kind === "purchase_line" ? `${p.purchase_code} → ${p.ingredient_code}` : p.kind === "purchase" ? `${p.code} — ${p.local_date}` : "-")),
            values: clone(publicImportPayload(p)), errors: row.errors, warnings: row.warnings }; }), sheet_max_note: null } };
      } catch (error) { for (const url of attached) sandbox.removeImage(url); throw error; }
    },
    destroy() { if (destroyed) return; destroyed = true; workbook = undefined; for (const url of urls) { try { sandbox.removeImage(url); } catch { /* sandbox already disposed */ } } urls.clear(); stagedImages.clear(); },
  };
}
