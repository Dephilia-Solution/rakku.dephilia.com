import * as XLSX from "xlsx";
import { IMPORT_MAX_ROWS, IMPORT_MAX_RECIPE_ROWS, IMPORT_MAX_FILE_BYTES, type ImportDomain } from "./import-spec";
export { IMPORT_DOMAINS, IMPORT_MAX_ROWS, type ImportDomain } from "./import-spec";

export interface ImportRowError { field: string | null; message: string; }
export interface ParsedRow {
  /** Unique staging key, not the Excel row for auxiliary sheets. */
  rowNumber: number;
  payload: Record<string, unknown>;
  errors: ImportRowError[];
}
export interface ParseResult {
  headerOk: boolean;
  headerLabels: string[];
  rows: ParsedRow[];
  linked?: boolean;
}
export interface IngredientReference { id: string; name: string; unit: string; is_active?: boolean; }
export interface ImportTemplateSpec {
  fileName: string; sheetName: string; headers: string[];
  exampleRows: (string | number)[][]; guide: string[];
}

const INGREDIENT_HEADERS = ["kode_bahan", "nama", "satuan", "stok_awal", "biaya_per_satuan", "stok_minimum", "id_bahan"];
const RECIPE_HEADERS = ["kode_produk", "kode_bahan", "jumlah_per_porsi", "id_bahan", "satuan"];
const UNITS = new Set(["gram", "ml", "pcs", "kg", "liter"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key = (value: unknown) => String(value ?? "").trim().toLowerCase();
const text = (value: unknown) => String(value ?? "").trim();
const ingredientKey = (name: unknown, unit: unknown) => JSON.stringify([key(name), key(unit)]);
const addError = (row: ParsedRow, field: string | null, message: string) => {
  if (!row.errors.some(error => error.field === field && error.message === message)) row.errors.push({ field, message });
};
export const rowKind = (row: ParsedRow, domain: ImportDomain) => String(row.payload.kind ?? (domain === "products" ? "product" : domain === "ingredients" ? "ingredient" : "employee"));
export const isLinkedWorkbook = (rows: ParsedRow[]) => rows.some(row => row.payload.linked_workbook === true);

const INGREDIENT_GUIDE = [
  "BahanBaku: kode_bahan, nama, satuan, stok_awal, biaya_per_satuan, stok_minimum; id_bahan opsional.",
  "kode_bahan adalah kode unik lokal file ini, bukan ID database. Gunakan kode yang sama di Komposisi. Kode tidak membedakan huruf besar/kecil.",
  "Bahan baru hanya dibuat dari baris BahanBaku dengan nama+satuan baru tanpa id_bahan. Isi stok dan biaya pembukaan secara eksplisit (boleh 0).",
  "Bahan lama: isi id_bahan dari ReferensiBahan, atau nama+satuan yang cocok tepat dan unik di outlet tujuan. Jika nama sama tetapi satuan berbeda, gunakan nama baru yang jelas; tidak ada konversi satuan otomatis.",
  "Baris bahan lama HANYA referensi: stok_awal, biaya_per_satuan, stok_minimum tidak mengubah data lama. Kosongkan atau isi 0 agar tidak menyesatkan.",
  "Satuan yang didukung: gram, ml, pcs, kg, liter. Jumlah resep menggunakan satuan bahan tersebut (contoh 18 gram, bukan 0.018 kg).",
  "Semua angka maksimal 2 desimal, tanpa pemisah ribuan; stok/biaya/minimum >= 0 (maks 9999999999.99). Maksimal 500 baris BahanBaku.",
  "ReferensiBahan hanya daftar baca dari outlet tujuan; menambahkan baris di sana tidak membuat bahan. ID dari outlet/perusahaan lain ditolak.",
];

export function getTemplateSpec(domain: ImportDomain): ImportTemplateSpec {
  if (domain === "products") return {
    fileName: "template-produk.xlsx", sheetName: "Produk",
    headers: ["nama", "kategori", "harga", "deskripsi", "kode_produk"],
    exampleRows: [["Kopi Susu Gula Aren", "Minuman", 22000, "Kopi susu gula aren original", "P001"],
      ["Americano", "Minuman", 18000, "Espresso dan air", "P002"]],
    guide: [
      "Isi mulai baris kedua; pertahankan judul kolom. Ganti/hapus seluruh data contoh sebelum impor data bisnis.",
      "Produk sederhana tetap kompatibel: hanya nama,kategori,harga wajib; deskripsi dan kode_produk opsional. Hapus BahanBaku dan Komposisi jika tidak membutuhkan resep.",
      "nama maksimal 100 karakter; kategori wajib, maksimal 60 karakter (kategori baru otomatis dibuat); harga 0–99999999.99, maksimal 2 desimal.",
      "Untuk resep: kode_produk wajib unik pada Produk dan harus cocok dengan Komposisi. Kode produk hanya untuk file ini; tidak memperbarui produk lama.",
      "Komposisi: kode_produk,kode_bahan,jumlah_per_porsi. Alternatif bahan lama: isi id_bahan langsung, kosongkan kode_bahan. Jangan isi keduanya.",
      "jumlah_per_porsi harus > 0, maksimal 9999999999.99 dan 2 desimal (numeric12,2). Kolom satuan opsional harus cocok dengan satuan bahan, tanpa konversi.",
      "Satu pasangan produk+bahan hanya boleh satu baris. Maksimal 500 produk dan 2000 baris Komposisi.",
      "Workbook dengan baris BahanBaku/Komposisi diproses atomik: kesalahan apa pun memblokir konfirmasi seluruh file. Produk sederhana (termasuk sheet tambahan yang hanya berisi judul kolom) mengimpor baris valid saja.",
      ...INGREDIENT_GUIDE,
    ],
  };
  if (domain === "ingredients") return {
    fileName: "template-bahan-baku.xlsx", sheetName: "BahanBaku", headers: INGREDIENT_HEADERS,
    exampleRows: [["B001", "Biji kopi arabika", "gram", 1000, 180, 200, ""],
      ["B002", "Susu segar", "ml", 5000, 22, 1000, ""]],
    guide: ["Isi mulai baris kedua. Ganti/hapus seluruh contoh sebelum impor. Pilih outlet yang benar.", ...INGREDIENT_GUIDE,
      "Impor bahan diproses atomik: perbaiki semua kesalahan sebelum konfirmasi. Stok pembukaan bahan baru diperbolehkan pada paket dasar; impor ini bukan penyesuaian/pembelian stok."],
  };
  return {
    fileName: "template-karyawan.xlsx", sheetName: "Karyawan", headers: ["nama", "username", "pin", "role", "outlets"],
    exampleRows: [["Budi Santoso", "budi", "123456", "Kasir", "Semua"],
      ["Sari Dewi", "sari", "654321", "Kasir", "Outlet Utama, Outlet Cabang"]],
    guide: ["Isi mulai baris kedua; baris pertama (judul kolom) jangan diubah.", "nama: wajib, maksimal 60 karakter.",
      "username: wajib, huruf kecil/angka/underscore, 3-20 karakter, unik.", "pin: tepat 6 digit. Simpan sebagai teks agar nol di depan tetap ada.",
      "role: nama role yang sudah ada (misal Kasir).", "outlets: nama outlet dipisah koma, atau Semua untuk semua outlet.",
      "Data contoh boleh diganti atau dihapus; pertahankan judul kolom. Baris valid saja yang diimpor."],
  };
}

function decimal(raw: string, max = 9999999999.99, positive = false): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value <= max && (positive ? value > 0 : value >= 0) ? value : null;
}

export function parseWorkbook(data: ArrayBuffer, domain: ImportDomain): ParseResult {
  if (data.byteLength > IMPORT_MAX_FILE_BYTES) throw new Error("Maksimal ukuran file 2 MB.");
  const spec = getTemplateSpec(domain);
  const wb = XLSX.read(data, { type: "array", sheetRows: IMPORT_MAX_RECIPE_ROWS + 3 });
  const findSheet = (name: string) => wb.SheetNames.find(sheet => key(sheet) === key(name));
  const main = findSheet(spec.sheetName) ?? wb.SheetNames.find(name => !["petunjuk", "referensibahan", "komposisi", ...(domain === "products" ? ["bahanbaku"] : [])].includes(key(name)));
  const linked = domain === "ingredients" || (domain === "products" && !!(findSheet("BahanBaku") || findSheet("Komposisi")));
  const result: ParseResult = { headerOk: false, headerLabels: [], rows: [], linked };
  if (!main) return result;

  const readSheet = (sheet: string, kind: string, offset: number, maxRows: number, required: string[], primary = false) => {
    const ws = wb.Sheets[sheet];
    const range = ws["!fullref"] ?? ws["!ref"];
    if (range && (XLSX.utils.decode_range(range).e.r > maxRows + 1 || XLSX.utils.decode_range(range).e.c > 50)) {
      throw new Error(`Maksimal ${maxRows} baris data dan 51 kolom pada sheet ${sheet}. Pisahkan data ke beberapa file.`);
    }
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: true });
    const headers = (grid[0] ?? []).map(value => key(value));
    const headerOk = required.every(label => headers.includes(label)) && headers.filter(Boolean).length === new Set(headers.filter(Boolean)).size;
    if (primary) { result.headerOk = headerOk; result.headerLabels = (grid[0] ?? []).map(text); }
    if (!headerOk) {
      if (!primary) result.rows.push({ rowNumber: offset + 1, payload: { kind, sheet_name: sheet, sheet_row: 1, linked_workbook: true },
        errors: [{ field: null, message: `Kolom sheet ${sheet} tidak sesuai: ${required.join(", ")}` }] });
      return;
    }
    let count = 0;
    grid.slice(1).forEach((cells, index) => {
      if (!(cells ?? []).some(value => text(value))) return;
      if (++count > maxRows) throw new Error(`Maksimal ${maxRows} baris pada sheet ${sheet}.`);
      const value = (label: string) => text(cells[headers.indexOf(label)]);
      const sourceRow = index + 2;
      const row: ParsedRow = { rowNumber: offset + sourceRow, payload: { kind, sheet_name: sheet, sheet_row: sourceRow, ...(linked ? { linked_workbook: true } : {}) }, errors: [] };
      const p = row.payload;
      const name = value("nama");
      if (kind !== "recipe") {
        p.name = name || null;
        const maxName = kind === "employee" ? 60 : 100;
        if (!name) addError(row, "nama", "Nama wajib diisi");
        else if (name.length > maxName) addError(row, "nama", `Nama maksimal ${maxName} karakter`);
      }
      if (kind === "product") {
        p.category_name = value("kategori") || null; p.price = decimal(value("harga"), 99999999.99);
        p.description = value("deskripsi") || null; p.product_code = value("kode_produk");
        if (!p.category_name) addError(row, "kategori", "Kategori wajib diisi");
        else if (String(p.category_name).length > 60) addError(row, "kategori", "Kategori maksimal 60 karakter");
        if (p.price === null) addError(row, "harga", "Harga harus angka 0–99999999.99, maksimal 2 desimal, tanpa pemisah ribuan");
      } else if (kind === "ingredient") {
        p.ingredient_code = value("kode_bahan"); p.unit = key(value("satuan")); p.ingredient_id = key(value("id_bahan")) || null;
        if (!p.ingredient_code) addError(row, "kode_bahan", "Kode bahan wajib diisi dan unik dalam file");
        if (!UNITS.has(String(p.unit))) addError(row, "satuan", "Satuan harus gram, ml, pcs, kg, atau liter; tidak ada konversi otomatis");
        if (p.ingredient_id && !UUID.test(String(p.ingredient_id))) addError(row, "id_bahan", "ID bahan harus UUID dari outlet tujuan");
        for (const [column, field] of [["stok_awal", "stock_quantity"], ["biaya_per_satuan", "cost_per_unit"], ["stok_minimum", "min_stock_alert"]]) {
          // Blank opening values are allowed for existing references; new rows require explicit numbers below.
          p[field] = value(column) === "" ? null : decimal(value(column));
          if (value(column) !== "" && p[field] === null) addError(row, column, `${column} harus angka 0–9999999999.99, maksimal 2 desimal`);
        }
      } else if (kind === "recipe") {
        p.product_code = value("kode_produk"); p.ingredient_code = value("kode_bahan");
        p.ingredient_id = key(value("id_bahan")) || null; p.unit = key(value("satuan")) || null;
        p.quantity_used = decimal(value("jumlah_per_porsi"), 9999999999.99, true);
        if (!p.product_code) addError(row, "kode_produk", "Kode produk wajib diisi");
        if (!!p.ingredient_code === !!p.ingredient_id) addError(row, "kode_bahan", "Isi tepat satu: kode_bahan atau id_bahan");
        if (p.ingredient_id && !UUID.test(String(p.ingredient_id))) addError(row, "id_bahan", "ID bahan tidak valid");
        if (p.quantity_used === null) addError(row, "jumlah_per_porsi", "Jumlah per porsi harus > 0, maksimal 9999999999.99 dan 2 desimal");
      } else {
        const username = key(value("username")); const pin = value("pin"); const outlets = value("outlets");
        p.username = username || null; p.pin = /^\d{6}$/.test(pin) ? pin : null; p.role_name = value("role") || null;
        p.outlet_names = ["semua", "all", "semua outlet"].includes(key(outlets)) ? ["__ALL__"] : outlets.split(/[,;]/).map(text).filter(Boolean);
        if (!/^[a-z0-9_]{3,20}$/.test(username)) addError(row, "username", "Username harus 3-20 karakter huruf kecil, angka, atau underscore");
        if (!p.pin) addError(row, "pin", "PIN harus tepat 6 digit angka");
        if (!p.role_name) addError(row, "role", "Role wajib diisi");
        if (!outlets) addError(row, "outlets", "Outlet wajib diisi (nama outlet atau Semua)");
      }
      result.rows.push(row);
    });
  };
  readSheet(main, domain === "products" ? "product" : domain === "ingredients" ? "ingredient" : "employee", 0, IMPORT_MAX_ROWS[domain],
    domain === "products" ? ["nama", "kategori", "harga"] : domain === "ingredients" ? INGREDIENT_HEADERS.slice(0, 6) : spec.headers, true);
  if (domain === "products" && result.headerOk) {
    const ingredients = findSheet("BahanBaku"); const recipes = findSheet("Komposisi");
    if (ingredients) readSheet(ingredients, "ingredient", 100000, IMPORT_MAX_ROWS.ingredients, INGREDIENT_HEADERS.slice(0, 6));
    // kode_bahan may be blank for explicit IDs, but the standard header remains required.
    if (recipes) readSheet(recipes, "recipe", 200000, IMPORT_MAX_RECIPE_ROWS, RECIPE_HEADERS.slice(0, 3));
  }
  if (domain === "products" && !result.rows.some(row => row.payload.kind === "ingredient" || row.payload.kind === "recipe")) {
    result.linked = false;
    for (const row of result.rows) delete row.payload.linked_workbook;
  }
  return result;
}

export interface ValidationContext {
  existingProductNames?: Set<string>; existingUsernames?: Set<string>;
  roleNameMap?: Map<string, { id: string; name: string }>; outletNameMap?: Map<string, { id: string; name: string }>;
  existingIngredients?: IngredientReference[];
}

function duplicate(rows: ParsedRow[], field: string, column: string, message: string) {
  const groups = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const value = key(row.payload[field]); if (!value) continue;
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  for (const group of groups.values()) if (group.length > 1) for (const row of group) addError(row, column, message);
}

export function validateRows(domain: ImportDomain, rows: ParsedRow[], ctx: ValidationContext): void {
  const products = rows.filter(row => rowKind(row, domain) === "product");
  const ingredients = rows.filter(row => rowKind(row, domain) === "ingredient");
  const recipes = rows.filter(row => rowKind(row, domain) === "recipe");
  const employees = rows.filter(row => rowKind(row, domain) === "employee");
  // Keep the existing valid-rows-only semantics for plain files (later duplicates fail).
  const seen = new Set<string>();
  for (const row of [...products, ...employees]) {
    const employee = rowKind(row, domain) === "employee";
    const value = key(row.payload[employee ? "username" : "name"]);
    const field = employee ? "username" : "nama";
    if (value && seen.has(value)) addError(row, field, employee ? "Username duplikat di dalam file" : "Nama produk duplikat di dalam file");
    if (value) seen.add(value);
    if ((employee ? ctx.existingUsernames : ctx.existingProductNames)?.has(value)) addError(row, field,
      employee ? "Username sudah dipakai karyawan lain" : "Produk dengan nama ini sudah ada di outlet");
    if (employee) {
      if (row.payload.role_name && ctx.roleNameMap && !ctx.roleNameMap.has(key(row.payload.role_name))) addError(row, "role", `Role "${row.payload.role_name}" tidak ditemukan`);
      if (Array.isArray(row.payload.outlet_names) && ctx.outletNameMap) {
        const unknown = row.payload.outlet_names.filter(name => name !== "__ALL__" && !ctx.outletNameMap!.has(key(name)));
        if (unknown.length) addError(row, "outlets", `Outlet tidak ditemukan: ${unknown.join(", ")}`);
      }
    }
  }
  duplicate(products, "product_code", "kode_produk", "Kode produk duplikat di dalam file");
  duplicate(ingredients, "ingredient_code", "kode_bahan", "Kode bahan duplikat di dalam file");
  const refs = ctx.existingIngredients ?? [];
  const byId = new Map(refs.map(ref => [key(ref.id), ref]));
  for (const row of ingredients) {
    const p = row.payload;
    const matches = refs.filter(ref => ingredientKey(ref.name, ref.unit) === ingredientKey(p.name, p.unit));
    const explicit = p.ingredient_id ? byId.get(key(p.ingredient_id)) : undefined;
    const existing = p.ingredient_id ? explicit : matches.length === 1 ? matches[0] : undefined;
    delete p.resolved_ingredient_id;
    if (p.ingredient_id && !explicit) addError(row, "id_bahan", "Bahan tidak ditemukan di outlet tujuan");
    if (!p.ingredient_id && matches.length > 1) addError(row, "nama", "Nama+satuan bahan ambigu; isi id_bahan yang tepat");
    if (!p.ingredient_id && !matches.length && refs.some(ref => key(ref.name) === key(p.name))) addError(row, "satuan", "Nama bahan sudah ada dengan satuan berbeda; tidak ada konversi satuan otomatis");
    if (existing) {
      p.ingredient_mode = "existing"; p.resolved_ingredient_id = existing.id;
      if (key(existing.name) !== key(p.name)) addError(row, "nama", "Nama tidak cocok dengan id_bahan");
      if (key(existing.unit) !== key(p.unit)) addError(row, "satuan", "Satuan tidak cocok dengan bahan lama; tidak ada konversi otomatis");
      if (existing.is_active === false) addError(row, "id_bahan", "Bahan tidak aktif");
      for (const field of ["stock_quantity", "cost_per_unit", "min_stock_alert"]) {
        if (p[field] !== null && p[field] !== 0) addError(row, field, "Bahan lama hanya referensi. Kosongkan/isi 0 pada stok_awal, biaya_per_satuan, dan stok_minimum; data lama tidak diubah");
      }
    } else {
      p.ingredient_mode = "new";
      for (const [field, column] of [["stock_quantity", "stok_awal"], ["cost_per_unit", "biaya_per_satuan"], ["min_stock_alert", "stok_minimum"]]) {
        if (p[field] === null) addError(row, column, `${column} bahan baru wajib diisi angka (boleh 0)`);
      }
    }
    p.identity_key = existing ? `id:${key(existing.id)}` : ingredientKey(p.name, p.unit);
  }
  duplicate(ingredients, "identity_key", "nama", "Bahan yang sama dideklarasikan lebih dari sekali");
  const productMap = new Map(products.map(row => [key(row.payload.product_code), row]));
  const ingredientMap = new Map(ingredients.map(row => [key(row.payload.ingredient_code), row]));
  for (const row of recipes) {
    const p = row.payload;
    delete p.resolved_ingredient_id;
    delete p.resolved_unit;
    const product = productMap.get(key(p.product_code));
    if (!product || !p.product_code) addError(row, "kode_produk", "Kode produk tidak ditemukan pada sheet Produk");
    const ingredient = p.ingredient_code ? ingredientMap.get(key(p.ingredient_code)) : undefined;
    const existing = p.ingredient_id ? byId.get(key(p.ingredient_id)) : undefined;
    if (p.ingredient_code && !ingredient) addError(row, "kode_bahan", "Kode bahan tidak ditemukan pada sheet BahanBaku");
    if (p.ingredient_id && (!existing || existing.is_active === false)) addError(row, "id_bahan", "Bahan aktif tidak ditemukan di outlet tujuan");
    const unit = ingredient?.payload.unit ?? existing?.unit;
    if (unit) p.resolved_unit = key(unit);
    if (p.unit && unit && key(p.unit) !== key(unit)) addError(row, "satuan", "Satuan resep tidak cocok dengan bahan; tidak ada konversi otomatis");
    p.recipe_key = JSON.stringify([key(p.product_code), ingredient?.payload.identity_key ?? `id:${key(p.ingredient_id)}`]);
    if (existing) p.resolved_ingredient_id = existing.id;
  }
  duplicate(recipes, "recipe_key", "kode_bahan", "Pasangan produk+bahan duplikat di Komposisi");
  finalizeLinkedRows(rows);
}

/** Run again after quota validation so linked failures are reflected on product rows. */
export function finalizeLinkedRows(rows: ParsedRow[]): void {
  if (!isLinkedWorkbook(rows)) return;
  const badIngredients = new Set(rows.filter(row => row.payload.kind === "ingredient" && row.errors.length).map(row => key(row.payload.ingredient_code)));
  for (const row of rows.filter(row => row.payload.kind === "recipe")) {
    if (row.payload.ingredient_code && badIngredients.has(key(row.payload.ingredient_code))) addError(row, "kode_bahan", "Baris BahanBaku terkait bermasalah; perbaiki sebelum konfirmasi");
  }
  const badProducts = new Set(rows.filter(row => row.payload.kind === "recipe" && row.errors.length).map(row => key(row.payload.product_code)));
  for (const row of rows.filter(row => row.payload.kind === "product")) {
    if (row.payload.product_code && badProducts.has(key(row.payload.product_code))) addError(row, "kode_produk", "Komposisi produk ini bermasalah; periksa sheet Komposisi/BahanBaku");
  }
}

export function applyPlanBudget(domain: ImportDomain, rows: ParsedRow[], budget: number | null): void {
  if (budget === null) return;
  let used = 0;
  for (const row of rows) {
    const kind = rowKind(row, domain);
    if (kind !== (domain === "products" ? "product" : domain === "ingredients" ? "ingredient" : "employee")) continue;
    if (row.errors.length || (kind === "ingredient" && row.payload.ingredient_mode === "existing")) continue;
    if (used++ >= budget) addError(row, null, `Melebihi kuota ${domain === "products" ? "produk" : domain === "ingredients" ? "bahan baku" : "karyawan"} paket Anda`);
  }
}

export function buildTemplateWorkbook(domain: ImportDomain, references: IngredientReference[] = []): Uint8Array {
  const spec = getTemplateSpec(domain);
  const wb = XLSX.utils.book_new();
  const append = (name: string, headers: string[], rows: (string | number)[][]) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(header => ({ wch: Math.max(18, header.length + 6) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  append(spec.sheetName, spec.headers, spec.exampleRows);
  if (domain === "products") {
    // Realistic gram/ml recipes, all references declared and no implicit kg conversion.
    append("BahanBaku", INGREDIENT_HEADERS, [["B001", "Biji kopi arabika", "gram", 1000, 180, 200, ""],
      ["B002", "Susu segar", "ml", 5000, 22, 1000, ""], ["B003", "Sirup gula aren", "ml", 1000, 45, 200, ""]]);
    append("Komposisi", RECIPE_HEADERS, [["P001", "B001", 18, "", "gram"], ["P001", "B002", 150, "", "ml"],
      ["P001", "B003", 20, "", "ml"], ["P002", "B001", 18, "", "gram"]]);
  }
  if (domain !== "employees") append("ReferensiBahan", ["id_bahan", "nama", "satuan"], references.filter(ref => ref.is_active !== false).map(ref => [ref.id, ref.name, ref.unit]));
  const guide = XLSX.utils.aoa_to_sheet([[`${spec.sheetName} — Panduan Import`], ...spec.guide.map(line => [line])]);
  guide["!cols"] = [{ wch: 130 }];
  XLSX.utils.book_append_sheet(wb, guide, "Petunjuk");
  return new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
}
