import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { validateWorkbookArchive } from "./workbook-archive";
import { IMPORT_HEADERS, IMPORT_MAX_FILE_BYTES, IMPORT_MAX_RECIPE_ROWS, IMPORT_MAX_PURCHASE_LINES,
  IMPORT_METADATA_KEYS, IMPORT_METADATA_SHEET, IMPORT_UUID, tierHeader, assertProductMetadata,
  type BackendImportDomain as ImportDomain, type ImportTier, type ProductImportMetadata } from "./import-spec";
export { IMPORT_BACKEND_DOMAINS as IMPORT_DOMAINS, IMPORT_HEADERS, IMPORT_MAX_FILE_BYTES, IMPORT_MAX_RECIPE_ROWS, IMPORT_MAX_ROWS,
  type ImportConflictMode, type BackendImportDomain as ImportDomain } from "./import-spec";

export interface ImportRowError { field: string | null; message: string; }
export interface ParsedRow { rowNumber: number; payload: Record<string, unknown>; errors: ImportRowError[]; warnings: ImportRowError[]; }
export interface ParseResult { headerOk: boolean; headerLabels: string[]; rows: ParsedRow[]; linked?: boolean; visibleSheets: string[];
  schemaVersion: 1 | 2; metadata?: ProductImportMetadata; structuralErrors: ImportRowError[]; }
export interface IngredientReference { id: string; code: string; name: string; unit: string; is_active?: boolean; }
export interface ExistingProductReference { id: string; code: string; name: string; category_name?: string; price?: number; description?: string | null; }
export interface ImportTemplateSpec { fileName: string; sheetName: string; headers: string[]; guide: string[]; }
const UNITS = new Set(["gram", "ml", "pcs", "kg", "liter"]);
const key = (value: unknown) => String(value ?? "").trim().normalize("NFKC").toLocaleLowerCase("id-ID");
const displayText = (value: unknown) => value == null ? "" : String(value).trim();
const addIssue = (list: ImportRowError[], field: string | null, message: string) => { if (!list.some(issue => issue.field === field && issue.message === message)) list.push({ field, message }); };
export const rowKind = (row: ParsedRow, domain: ImportDomain) => String(row.payload.kind ?? (domain === "products" ? "product" : domain === "ingredients" ? "ingredient" : "employee"));
export const isLinkedWorkbook = (rows: ParsedRow[]) => rows.some(row => row.payload.linked_workbook === true);

export function getTemplateSpec(domain: ImportDomain): ImportTemplateSpec {
  if (domain === "purchases") return { fileName: "template-pembelian.xlsx", sheetName: "Pembelian", headers: [...IMPORT_HEADERS.purchases], guide: [
    "Pembelian dan Detail Pembelian menggunakan kode_pembelian unik pada outlet tujuan. Seluruh workbook disimpan atomik.",
    "Tanggal berupa teks YYYY-MM-DD (pukul 00:00 WIB). Satu pembelian berisi 1–100 bahan aktif berbeda; satuan harus tepat, tanpa konversi.",
    "Kode pembelian yang sama dengan isi sama dilewati permanen; isi berbeda ditolak. Urutan header menentukan urutan pencatatan dan biaya terakhir."] };
  if (domain === "ingredients") return { fileName: "template-bahan-baku.xlsx", sheetName: "Bahan Baku", headers: [...IMPORT_HEADERS.ingredients], guide: [
    "Satu sheet, enam kolom dengan urutan tetap. Isi kode sebagai teks; kode unik dalam outlet aktif.",
    "Dropdown satuan: gram, ml, pcs, kg, liter. Anda tetap dapat mengetik manual; server memvalidasi nilainya.",
    "Kode yang sudah ada dapat dilewati atau diperbarui. Update tidak mengubah stok aktual; gunakan Pembelian/Stock Opname.",
    "Isi angka sebagai nilai numerik. Format ribuan dan tampilan Rupiah tidak mengubah nilai sel."] };
  if (domain === "products") return { fileName: "template-produk.xlsx", sheetName: "Produk", headers: [...IMPORT_HEADERS.products], guide: [
    "Dua sheet terlihat saja: Produk dan Komposisi. Header wajib tepat dan berurutan.",
    "Kategori memiliki dropdown outlet aktif dan tetap mengizinkan input manual. Kategori baru meminta persetujuan saat preview.",
    "Komposisi per satu porsi mengacu kode_produk dan kode_bahan. Tanpa konversi satuan.",
    "Kode existing default dilewati. Pilih Perbarui bila ingin mengganti informasi produk/komposisinya. Komposisi tidak diubah jika produk tidak tercantum pada Komposisi.",
    "Kesalahan pada workbook yang berisi komposisi membatalkan penyimpanan seluruh file."] };
  return { fileName: "template-karyawan.xlsx", sheetName: "Karyawan", headers: ["nama", "username", "pin", "role", "outlets"],
    guide: ["PIN tepat enam digit; simpan sebagai teks. Username unik. Role harus sudah tersedia. Outlet dipisahkan koma atau isi Semua."] };
}

/** Excel numeric cells are locale-independent; parse common locale-formatted text without mistaking numeric cell formatting for text. */
function numeric(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let value = displayText(raw).replace(/^(?:rp\.?\s*)/i, "").replace(/\s/g, "");
  if (!value || !/^[0-9.,]+$/.test(value)) return null;
  const comma = value.lastIndexOf(","), dot = value.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimalAt = Math.max(comma, dot), digits = value.length - decimalAt - 1;
    if (digits < 1 || digits > 2) return null;
    value = `${value.slice(0, decimalAt).replace(/[.,]/g, "")}.${value.slice(decimalAt + 1)}`;
  } else if (comma >= 0) {
    const digits = value.length - comma - 1;
    if (digits === 1 || digits === 2) value = `${value.slice(0, comma).replace(/,/g, "")}.${value.slice(comma + 1)}`;
    else if (digits === 3) value = value.replace(/,/g, ""); else return null;
  } else if (dot >= 0) {
    const digits = value.length - dot - 1;
    if (digits === 3 && dot > 0) value = value.replace(/\./g, "");
    else if (digits < 1 || digits > 2) return null;
  }
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
function amount(raw: unknown, maximum = 9999999999.99, positive = false) {
  const value = numeric(raw);
  return value !== null && value <= maximum && value >= (positive ? Number.EPSILON : 0)
    && (!positive || Math.round(value*100)>0) && Math.abs(Math.round(value * 100) - value * 100) <= 0.001 ? Math.round(value * 100) / 100 : null;
}

/** Date-only input is deliberately independent of the server timezone and Excel's serial-date system. */
export function purchaseDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  const date = raw.trim(), parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? `${date}T00:00:00+07:00` : null;
}
function code(raw: unknown, field: string, row: ParsedRow) {
  if (typeof raw === "number") { addIssue(row.errors, field, `${field}: simpan kode sebagai teks agar angka nol di depan tidak hilang.`); return String(raw); }
  const result = displayText(raw).normalize("NFKC").toLocaleUpperCase("id-ID");
  if (!result) addIssue(row.errors, field, `${field}: wajib diisi.`);
  else if (result.length > 64 || !/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(result)) addIssue(row.errors, field, `${field}: gunakan 1–64 huruf, angka, titik, garis bawah, atau tanda hubung.`);
  else if (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(result)) addIssue(row.errors, field, `${field}: UUID/ID database bukan kode bisnis dan tidak dapat digunakan.`);
  return result;
}
function fieldName(raw: unknown, row: ParsedRow, field: string, max: number) {
  const value = displayText(raw).normalize("NFKC");
  if (!value) addIssue(row.errors, field, `${field}: wajib diisi.`);
  else if (value.length > max) addIssue(row.errors, field, `${field}: maksimal ${max} karakter.`);
  return value;
}
function exactHeader(grid: unknown[][], expected: readonly string[]) {
  const actual = (grid[0] ?? []).map(displayText);
  return { actual, ok: actual.length === expected.length && expected.every((label, index) => actual[index] === label) };
}
function formulaAt(sheet: XLSX.WorkSheet, row: number, col: number) { return Boolean(sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.f); }

export function parseWorkbook(data: ArrayBuffer, domain: ImportDomain): ParseResult {
  if (data.byteLength > IMPORT_MAX_FILE_BYTES) throw new Error("Ukuran file maksimal 2 MB.");
  if (new Uint8Array(data,0,Math.min(data.byteLength,4)).join(",") !== "80,75,3,4") throw new Error("File harus workbook .xlsx asli, bukan ZIP pembungkus/CSV/format Excel lain.");
  validateWorkbookArchive(data);
  const workbook = XLSX.read(data, { type: "array", sheetRows: (domain === "purchases" ? IMPORT_MAX_PURCHASE_LINES : IMPORT_MAX_RECIPE_ROWS) + 3, cellFormula: true });
  const hidden = new Map((workbook.Workbook?.Sheets ?? []).map(sheet => [sheet.name, sheet.Hidden ?? 0]));
  const visibleSheets = workbook.SheetNames.filter(name => hidden.get(name) !== 1 && hidden.get(name) !== 2);
  const expected = domain === "products" ? ["Produk", "Komposisi"] : domain === "purchases" ? ["Pembelian", "Detail Pembelian"] : [getTemplateSpec(domain).sheetName];
  const result: ParseResult = { headerOk: false, headerLabels: [], rows: [], visibleSheets, schemaVersion: 1, structuralErrors: [] };
  const structural = (message: string) => { addIssue(result.structuralErrors, null, message); result.headerOk = false; return result; };
  if (visibleSheets.length !== expected.length || visibleSheets.some((name, index) => name !== expected[index])) return structural(`Sheet terlihat wajib tepat dan berurutan: ${expected.join(", ")}.`);
  if (workbook.SheetNames.some(name => !expected.includes(name) && !(domain === "products" && ["_kategori", IMPORT_METADATA_SHEET].includes(name) && hidden.get(name) === 2))) return structural("Sheet tambahan/tidak dikenal atau metadata tidak veryHidden.");
  const productHeaders: string[] = [...IMPORT_HEADERS.products];
  if (domain === "products" && workbook.Sheets[IMPORT_METADATA_SHEET]) {
    try {
      const sheet = workbook.Sheets[IMPORT_METADATA_SHEET];
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: true });
      if (grid.length !== IMPORT_METADATA_KEYS.length || grid.some((cells, i) => cells.length !== 2 || cells[0] !== IMPORT_METADATA_KEYS[i]
        || formulaAt(sheet, i, 0) || formulaAt(sheet, i, 1))) throw new Error("Metadata harus tepat lima baris key/value yang ditentukan.");
      const fields = Object.fromEntries(grid.map(cells => [String(cells[0]), cells[1]]));
      const tiers: ImportTier[] = JSON.parse(String(fields.tiers));
      if (String(fields.schema_version) !== "2" || fields.domain !== "products" || !IMPORT_UUID.test(String(fields.company_id)) || !IMPORT_UUID.test(String(fields.outlet_id))
        || !Array.isArray(tiers) || tiers.length > 100 || tiers.some(tier => !tier || Object.keys(tier).sort().join() !== "header,id,name,slug" || !IMPORT_UUID.test(tier.id)
          || typeof tier.name !== "string" || !tier.name.trim() || tier.name.length > 200 || typeof tier.slug !== "string" || !tier.slug || tier.slug.length > 200 || tier.header !== tierHeader(tier.slug))
        || new Set(tiers.map(tier => tier.id)).size !== tiers.length || new Set(tiers.map(tier => tier.header)).size !== tiers.length) throw new Error("Identitas atau pemetaan tier tidak valid.");
      result.metadata = { schema_version: 2, domain: "products", company_id: String(fields.company_id), outlet_id: String(fields.outlet_id), tiers };
      result.schemaVersion = 2;
      productHeaders.push(...tiers.map(tier => tier.header));
      const actual = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Produk, { header: 1 })[0] ?? [];
      if (actual[actual.length - 1] === "gambar") productHeaders.push("gambar");
    } catch (error) { return structural(`Metadata v2 tidak valid: ${error instanceof Error ? error.message : "unduh template terbaru"}`); }
  }
  const linked = domain === "products" || domain === "purchases";
  const read = (sheetName: string, kind: "ingredient" | "product" | "recipe" | "employee" | "purchase" | "purchase_line", offset: number, maximum: number, headers: readonly string[], primary = false) => {
    const sheet = workbook.Sheets[sheetName], range = sheet["!fullref"] ?? sheet["!ref"];
    if (range && XLSX.utils.decode_range(range).e.c >= headers.length) throw new Error(`Sheet ${sheetName}: hanya ${headers.length} kolom yang ditentukan; hapus kolom tambahan.`);
    if (range && XLSX.utils.decode_range(range).e.r > maximum + 1) throw new Error(`Sheet ${sheetName}: maksimal ${maximum} baris data.`);
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: true });
    const header = exactHeader(grid, headers);
    if (headers.some((_label, column) => formulaAt(sheet, 0, column))) header.ok = false;
    if (primary) { result.headerOk = header.ok; result.headerLabels = header.actual; }
    if (!header.ok) {
      structural(`Sheet ${sheetName}: header harus tepat dan berurutan: ${headers.join(", ")}`);
      result.rows.push({ rowNumber: offset + 1, payload: { kind, sheet_name: sheetName, sheet_row: 1 },
        errors: [{ field: null, message: `Header harus tepat dan berurutan: ${headers.join(", ")}` }], warnings: [] });
      return;
    }
    let count = 0;
    grid.slice(1).forEach((cells, index) => {
      const sourceRow = index + 2;
      if (!(cells ?? []).some(cell => displayText(cell))) return;
      if (++count > maximum) throw new Error(`Sheet ${sheetName}: maksimal ${maximum} baris data.`);
      const row: ParsedRow = { rowNumber: offset + sourceRow,
        payload: { kind, sheet_name: sheetName, sheet_row: sourceRow, ...(linked && (kind === "recipe" || domain === "purchases") ? { linked_workbook: true } : {}) }, errors: [], warnings: [] };
      for (let col = 0; col < headers.length; col++) if (formulaAt(sheet, sourceRow - 1, col)) addIssue(row.errors, headers[col], `${headers[col]}: formula Excel tidak didukung, tempel nilai akhirnya sebagai data.`);
      const get = (headerName: string) => (cells ?? [])[headers.indexOf(headerName)];
      const p = row.payload;
      if (kind === "ingredient") {
        p.code = code(get("kode_bahan"), "kode_bahan", row); p.name = fieldName(get("nama"), row, "nama", 100);
        p.unit = displayText(get("satuan")).normalize("NFKC").toLowerCase();
        if (!UNITS.has(String(p.unit))) addIssue(row.errors, "satuan", "satuan: pilih gram, ml, pcs, kg, atau liter.");
        for (const [column, field] of [["stok_awal", "stock_quantity"], ["biaya_per_satuan(Rp)", "cost_per_unit"], ["stok_minimum", "min_stock_alert"]]) {
          p[field] = amount(get(column));
          if (p[field] === null) addIssue(row.errors, column, `${column}: wajib angka nonnegatif dengan maksimal dua desimal.`);
        }
      } else if (kind === "product") {
        p.code = code(get("kode_produk"), "kode_produk", row); p.name = fieldName(get("nama"), row, "nama", 100);
        p.category_name = displayText(get("kategori")).normalize("NFKC");
        if (!p.category_name) addIssue(row.errors, "kategori", "kategori: wajib diisi.");
        else if (String(p.category_name).length > 60) addIssue(row.errors, "kategori", "kategori: maksimal 60 karakter.");
        p.price = amount(get("harga"), 99999999.99);
        if (p.price === null) addIssue(row.errors, "harga", "harga: wajib angka 0–99999999.99 dengan maksimal dua desimal.");
        p.description = displayText(get("deskripsi"));
        if (String(p.description).length > 5000) addIssue(row.errors, "deskripsi", "deskripsi: maksimal 5000 karakter.");
        if (result.metadata) {
          p.tier_prices = result.metadata.tiers.map(tier => {
            const raw = get(tier.header), price = displayText(raw) ? amount(raw, 99999999.99) : null;
            if (displayText(raw) && price === null) addIssue(row.errors, tier.header, `${tier.header}: angka 0–99999999.99, maksimal dua desimal; kosong mempertahankan harga/fallback.`);
            return { ...tier, price, action: price === null ? "preserve_or_fallback" : "set" };
          });
          if (headers.includes("gambar")) p.image_reference = displayText(get("gambar"));
        }
      } else if (kind === "recipe") {
        p.product_code = code(get("kode_produk"), "kode_produk", row); p.ingredient_code = code(get("kode_bahan"), "kode_bahan", row);
        p.quantity_used = amount(get("jumlah_per_porsi"), 9999999999.99, true);
        if (p.quantity_used === null) addIssue(row.errors, "jumlah_per_porsi", "jumlah_per_porsi: wajib angka lebih dari 0 dan maksimal dua desimal.");
      } else if (kind === "purchase") {
        p.code = code(get("kode_pembelian"), "kode_pembelian", row); p.local_date = displayText(get("tanggal")); p.date = purchaseDate(get("tanggal"));
        if (!p.date) addIssue(row.errors, "tanggal", "tanggal: isi teks tanggal kalender YYYY-MM-DD (00:00 WIB), bukan serial/formula Excel.");
        p.supplier = displayText(get("pemasok")); p.note = displayText(get("catatan"));
        for (const [field, column] of [["supplier", "pemasok"], ["note", "catatan"]]) if (String(p[field]).length > 1000) addIssue(row.errors, column, `${column}: maksimal 1000 karakter.`);
      } else if (kind === "purchase_line") {
        p.purchase_code = code(get("kode_pembelian"), "kode_pembelian", row); p.ingredient_code = code(get("kode_bahan"), "kode_bahan", row);
        p.quantity = amount(get("jumlah"), 9999999999.99, true); p.unit_cost = amount(get("biaya_per_satuan(Rp)")); p.unit = displayText(get("satuan"));
        if (p.quantity === null) addIssue(row.errors, "jumlah", "jumlah: angka positif, maksimal 9999999999.99 dan dua desimal.");
        if (p.unit_cost === null) addIssue(row.errors, "biaya_per_satuan(Rp)", "biaya_per_satuan(Rp): angka nonnegatif, maksimal 9999999999.99 dan dua desimal.");
        if (!UNITS.has(String(p.unit))) addIssue(row.errors, "satuan", "satuan: harus tepat gram, ml, pcs, kg, atau liter; tanpa konversi.");
      } else {
        p.name = fieldName(get("nama"), row, "nama", 60); p.username = displayText(get("username")).toLowerCase(); p.pin = displayText(get("pin")); p.role_name = displayText(get("role"));
        const outlets = displayText(get("outlets")); p.outlet_names = ["semua", "all", "semua outlet"].includes(key(outlets)) ? ["__ALL__"] : outlets.split(/[,;]/).map(displayText).filter(Boolean);
        if (!/^[a-z0-9_]{3,20}$/.test(String(p.username))) addIssue(row.errors, "username", "username: 3–20 huruf kecil, angka, atau underscore.");
        if (!/^\d{6}$/.test(String(p.pin))) addIssue(row.errors, "pin", "pin: harus tepat enam digit.");
        if (!p.role_name) addIssue(row.errors, "role", "role: wajib diisi.");
        if (!outlets) addIssue(row.errors, "outlets", "outlets: isi nama outlet atau Semua.");
      }
      result.rows.push(row);
    });
  };
  if (domain === "ingredients") read("Bahan Baku", "ingredient", 0, 500, IMPORT_HEADERS.ingredients, true);
  else if (domain === "products") {
    read("Produk", "product", 0, 500, productHeaders, true);
    read("Komposisi", "recipe", 100000, IMPORT_MAX_RECIPE_ROWS, IMPORT_HEADERS.recipes);
    result.linked = result.rows.some(row => row.payload.kind === "recipe");
  } else if (domain === "purchases") {
    read("Pembelian", "purchase", 0, 100, IMPORT_HEADERS.purchases, true);
    read("Detail Pembelian", "purchase_line", 100000, IMPORT_MAX_PURCHASE_LINES, IMPORT_HEADERS.purchaseLines);
    result.linked = true;
  } else read("Karyawan", "employee", 0, 100, ["nama", "username", "pin", "role", "outlets"], true);
  if (result.structuralErrors.length) result.headerOk = false;
  return result;
}

export interface ValidationContext {
  existingProductCodes?: Map<string, ExistingProductReference>; existingProductNames?: Set<string>;
  existingIngredientCodes?: Map<string, IngredientReference>; existingUsernames?: Set<string>;
  roleNameMap?: Map<string, { id: string; name: string }>; outletNameMap?: Map<string, { id: string; name: string }>;
  existingCategories?: Map<string, { id: string; name: string }>;
  companyId?: string; outletId?: string; tiers?: ImportTier[]; metadata?: ProductImportMetadata;
  existingTierPrices?: Map<string, number>;
}
const duplicateCodes = (rows: ParsedRow[], select: (row: ParsedRow) => unknown, field: string, label: string) => {
  const seen = new Set<string>();
  for (const row of rows) { const value = key(select(row)); if (value && seen.has(value)) addIssue(row.errors, field, `${field}: kode ${label} duplikat di file ini.`); if (value) seen.add(value); }
};
export function validateRows(domain: ImportDomain, rows: ParsedRow[], ctx: ValidationContext): void {
  if (ctx.metadata) assertProductMetadata(ctx.metadata, ctx.companyId ?? "", ctx.outletId ?? "", ctx.tiers ?? []);
  const products = rows.filter(row => rowKind(row, domain) === "product"), ingredients = rows.filter(row => rowKind(row, domain) === "ingredient");
  const recipes = rows.filter(row => rowKind(row, domain) === "recipe"), employees = rows.filter(row => rowKind(row, domain) === "employee");
  duplicateCodes(products, row => row.payload.code, "kode_produk", "produk"); duplicateCodes(ingredients, row => row.payload.code, "kode_bahan", "bahan");
  duplicateCodes(employees, row => row.payload.username, "username", "username");
  for (const row of ingredients) {
    const existing = ctx.existingIngredientCodes?.get(key(row.payload.code));
    row.payload.conflict = Boolean(existing); row.payload.existing_id = existing?.id ?? null;
    if (existing) row.warnings.push({ field: "kode_bahan", message: `Kode sudah digunakan (${existing.code} — ${existing.name}). Pilih lewati atau perbarui; stok aktual tetap.` });
  }
  const productRows = new Map<string, ParsedRow>();
  for (const row of products) {
    const productCode = key(row.payload.code); if (!productCode) continue;
    if (!productRows.has(productCode)) productRows.set(productCode, row);
    const existing = ctx.existingProductCodes?.get(productCode);
    row.payload.conflict = Boolean(existing); row.payload.existing_id = existing?.id ?? null;
    if (existing) row.warnings.push({ field: "kode_produk", message: `Kode sudah digunakan (${existing.code} — ${existing.name}). Pilih lewati atau perbarui.` });
    if (Array.isArray(row.payload.tier_prices)) row.payload.tier_prices = row.payload.tier_prices.map(tier => {
      const saved = existing ? ctx.existingTierPrices?.get(`${existing.id}:${tier.id}`) : undefined;
      return {...tier,existing_price:saved??null,effective_price:tier.price??saved??row.payload.price,
        action:tier.price!==null?"set":saved!==undefined?"preserve":"base_price_fallback"};
    });
    if (ctx.metadata) row.payload.image_action = row.payload.image_reference ? "attach" : "preserve";
    if (ctx.existingProductNames?.has(key(row.payload.name)) && !existing) row.warnings.push({ field: "nama", message: "Nama serupa sudah ada dengan kode berbeda; identitas tetap ditentukan oleh kode_produk." });
    const category = ctx.existingCategories?.get(key(row.payload.category_name));
    row.payload.category_is_new = Boolean(row.payload.category_name && ctx.existingCategories && !category);
    if (row.payload.category_is_new) row.warnings.push({ field: "kategori", message: `Kategori baru "${row.payload.category_name}" menunggu persetujuan.` });
  }
  const ingredientsByCode = ctx.existingIngredientCodes ?? new Map<string, IngredientReference>();
  const seenPairs = new Set<string>();
  for (const row of recipes) {
    const productCode = key(row.payload.product_code), ingredientCode = key(row.payload.ingredient_code);
    const stagedProduct = productRows.get(productCode), existingProduct = ctx.existingProductCodes?.get(productCode);
    if (!stagedProduct && !existingProduct) addIssue(row.errors, "kode_produk", `kode_produk: ${row.payload.product_code} tidak ditemukan di Produk atau outlet aktif.`);
    if (!stagedProduct && existingProduct) {
      row.payload.conflict = true;
      row.warnings.push({ field: "kode_produk", message: `Produk ${existingProduct.code} sudah ada. Pilih Perbarui untuk mengubah komposisi; Lewati akan mempertahankan komposisi existing.` });
    }
    if (!ingredientsByCode.has(ingredientCode) || ingredientsByCode.get(ingredientCode)?.is_active === false) addIssue(row.errors, "kode_bahan", `kode_bahan: ${row.payload.ingredient_code} tidak ditemukan/aktif di outlet aktif; import bahan terlebih dahulu.`);
    const pair = JSON.stringify([productCode, ingredientCode]);
    if (seenPairs.has(pair)) addIssue(row.errors, "kode_bahan", "Komposisi: kode_produk + kode_bahan duplikat.");
    seenPairs.add(pair);
    if (stagedProduct?.payload.conflict) row.warnings.push({ field: "kode_produk", message: `Komposisi mengikuti pilihan konflik kode ${stagedProduct.payload.code}.` });
  }
  if (domain === "purchases") {
    const headers = rows.filter(row => row.payload.kind === "purchase"), lines = rows.filter(row => row.payload.kind === "purchase_line");
    duplicateCodes(headers, row => row.payload.code, "kode_pembelian", "pembelian");
    const byCode = new Map(headers.map(row => [key(row.payload.code), row]));
    const seen = new Set<string>();
    for (const row of lines) {
      const p = row.payload, header = byCode.get(key(p.purchase_code)), ingredient = ingredientsByCode.get(key(p.ingredient_code));
      if (!header) addIssue(row.errors, "kode_pembelian", "kode_pembelian: tidak tercantum pada sheet Pembelian.");
      if (!ingredient || ingredient.is_active === false) addIssue(row.errors, "kode_bahan", "kode_bahan: bahan aktif tidak ditemukan di outlet tujuan.");
      else { p.ingredient_id = ingredient.id; p.ingredient_name = ingredient.name; p.expected_unit = ingredient.unit;
        if (p.unit !== ingredient.unit) addIssue(row.errors, "satuan", `satuan: harus tepat ${ingredient.unit}; tanpa konversi.`); }
      const pair = JSON.stringify([key(p.purchase_code), key(p.ingredient_code)]);
      if (seen.has(pair)) addIssue(row.errors, "kode_bahan", "Bahan duplikat dalam pembelian yang sama."); seen.add(pair);
    }
    for (const row of headers) {
      const details = lines.filter(line => key(line.payload.purchase_code) === key(row.payload.code));
      row.payload.line_count = details.length;
      if (details.length < 1 || details.length > 100) addIssue(row.errors, "kode_pembelian", "Setiap pembelian wajib memiliki 1–100 baris bahan berbeda.");
      const totalCents = details.reduce((sum, line) => sum + (BigInt(Math.round(Number(line.payload.quantity ?? 0)*100))*BigInt(Math.round(Number(line.payload.unit_cost ?? 0)*100))+BigInt(50))/BigInt(100),BigInt(0));
      row.payload.total_amount = Number(totalCents) / 100;
      if (totalCents > BigInt(99999999999999)) addIssue(row.errors, "kode_pembelian", "Total pembelian maksimal 999999999999.99.");
    }
  }
  const seenUsernames = new Set<string>();
  for (const row of employees) {
    const username = key(row.payload.username);
    if (seenUsernames.has(username)) addIssue(row.errors, "username", "username: duplikat dalam file."); seenUsernames.add(username);
    row.payload.conflict = Boolean(ctx.existingUsernames?.has(username));
    if (row.payload.conflict) row.warnings.push({ field: "username", message: "Username sudah ada; pilih lewati atau perbarui." });
    if (row.payload.role_name && ctx.roleNameMap && !ctx.roleNameMap.has(key(row.payload.role_name))) addIssue(row.errors, "role", `role: "${row.payload.role_name}" tidak ditemukan.`);
    if (Array.isArray(row.payload.outlet_names) && ctx.outletNameMap) {
      const unknown = row.payload.outlet_names.filter(value => value !== "__ALL__" && !ctx.outletNameMap!.has(key(value)));
      if (unknown.length) addIssue(row.errors, "outlets", `outlets: tidak ditemukan ${unknown.join(", ")}.`);
    }
  }
}
export function applyPlanBudget(domain: ImportDomain, rows: ParsedRow[], budget: number | null): void {
  if (domain === "purchases") return;
  if (budget === null) return; let used = 0;
  for (const row of rows) {
    if (rowKind(row, domain) !== (domain === "products" ? "product" : domain === "employees" ? "employee" : "ingredient")) continue;
    if (row.errors.length || row.payload.conflict) continue;
    if (used++ >= budget) addIssue(row.errors, null, `Kuota ${domain === "products" ? "produk" : domain === "ingredients" ? "bahan baku" : "karyawan"} paket tidak mencukupi.`);
  }
}

/** Product category validation cells reference a very-hidden same-workbook range; errors are warnings and manual typing remains allowed. */
export async function buildTemplateWorkbook(domain: ImportDomain, categories: string[] = [], metadata?: ProductImportMetadata): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook(); workbook.creator = "Rakku"; workbook.calcProperties.fullCalcOnLoad = true;
  const setValidation = (sheet: ExcelJS.Worksheet, column: string, start: number, end: number, rule: ExcelJS.DataValidation) => {
    // Keep validations as worksheet-level ranges so the blank template stays header-only.
    const internal = sheet as unknown as { dataValidations: { add: (range: string, validation: ExcelJS.DataValidation) => void } };
    internal.dataValidations.add(`${column}${start}:${column}${end}`, rule);
  };
  const addSheet = (name: string, headers: readonly string[]) => {
    const sheet = workbook.addWorksheet(name); sheet.columns = headers.map((header,index) => ({ header, key: header, width: [26,32,28,26,30,20][index] ?? 24 }));
    // Setting each column's header above creates row 1; do not append another header row.
    sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    const row = sheet.getRow(1); row.height = 36;
    row.eachCell(cell => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF255D3D" } }; cell.alignment = { vertical: "middle", wrapText: true }; });
    return sheet;
  };
  if (domain === "ingredients") {
    const sheet = addSheet("Bahan Baku", IMPORT_HEADERS.ingredients);
    sheet.getColumn(1).numFmt = "@"; sheet.getColumn(4).numFmt = "#,##0.##"; sheet.getColumn(5).numFmt = '"Rp" #,##0.##'; sheet.getColumn(6).numFmt = "#,##0.##";
    setValidation(sheet, "C", 2, 501, { type: "list", formulae: ['"gram,ml,pcs,kg,liter"'], allowBlank: false, showErrorMessage: false, showInputMessage: true, promptTitle: "Satuan bahan", prompt: "Pilih atau ketik manual: gram, ml, pcs, kg, liter." });
    for (const column of ["D", "E", "F"]) setValidation(sheet, column, 2, 501, { type: "decimal", operator: "greaterThanOrEqual", formulae: [0], allowBlank: false, showErrorMessage: false });
    setValidation(sheet, "A", 2, 501, { type: "textLength", operator: "between", formulae: [1,64], allowBlank: false, showErrorMessage: false, showInputMessage: true, promptTitle: "Kode unik bahan", prompt: "Kode adalah identifier bahan pada outlet." });
  } else if (domain === "products") {
    const sheet = addSheet("Produk", [...IMPORT_HEADERS.products, ...(metadata ? [...metadata.tiers.map(tier => tier.header), "gambar"] : [])]); sheet.getColumn(1).numFmt = "@"; sheet.getColumn(4).numFmt = '"Rp" #,##0.##';
    if (metadata) {
      const meta = workbook.addWorksheet(IMPORT_METADATA_SHEET, { state: "veryHidden" });
      IMPORT_METADATA_KEYS.forEach(field => meta.addRow([field, field === "tiers" ? JSON.stringify(metadata.tiers) : String(metadata[field])]));
      metadata.tiers.forEach((_tier, index) => { sheet.getColumn(index + 6).numFmt = '"Rp" #,##0.##'; });
      sheet.getColumn(metadata.tiers.length + 6).numFmt = "@";
    }
    setValidation(sheet, "A", 2, 501, { type: "textLength", operator: "between", formulae: [1,64], allowBlank: false, showErrorMessage: false, showInputMessage: true, promptTitle: "Kode unik produk", prompt: "Kode adalah identifier produk pada outlet." });
    setValidation(sheet, "D", 2, 501, { type: "decimal", operator: "between", formulae: [0,99999999.99], allowBlank: false, showErrorMessage: false });
    const choices = [...new Set(categories.map(value => value.trim()).filter(Boolean))];
    if (choices.length) {
      const list = workbook.addWorksheet("_kategori", { state: "veryHidden" }); choices.forEach((name,index) => { list.getCell(index+1,1).value = name; });
      workbook.definedNames.add(`'_kategori'!$A$1:$A$${choices.length}`, "OutletCategories");
      setValidation(sheet, "C", 2, 501, { type: "list", formulae: ["=OutletCategories"], allowBlank: false, showErrorMessage: false, showInputMessage: true, promptTitle: "Kategori outlet", prompt: "Pilih dari daftar atau ketik kategori baru." });
    }
    const recipe = addSheet("Komposisi", IMPORT_HEADERS.recipes); recipe.getColumn(1).numFmt = "@"; recipe.getColumn(2).numFmt = "@"; recipe.getColumn(3).numFmt = "#,##0.##";
    for (const column of ["A", "B"]) setValidation(recipe, column, 2, 2001, { type: "textLength", operator: "between", formulae: [1,64], allowBlank: false, showErrorMessage: false });
    setValidation(recipe, "C", 2, 2001, { type: "decimal", operator: "greaterThan", formulae: [0], allowBlank: false, showErrorMessage: false });
  } else if (domain === "purchases") {
    const headers = addSheet("Pembelian", IMPORT_HEADERS.purchases); headers.getColumn(1).numFmt = "@"; headers.getColumn(2).numFmt = "@";
    const lines = addSheet("Detail Pembelian", IMPORT_HEADERS.purchaseLines); lines.getColumn(1).numFmt = "@"; lines.getColumn(2).numFmt = "@";
    lines.getColumn(3).numFmt = "#,##0.##"; lines.getColumn(5).numFmt = '"Rp" #,##0.##';
    setValidation(lines, "D", 2, 10001, { type: "list", formulae: ['"gram,ml,pcs,kg,liter"'], allowBlank: false, showErrorMessage: false });
  } else addSheet("Karyawan", getTemplateSpec(domain).headers);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
