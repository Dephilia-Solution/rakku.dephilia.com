// Preserve the current UI's exhaustive domain maps until its separate purchases integration.
export const IMPORT_DOMAINS = ["products", "employees", "ingredients"] as const;
export type ImportDomain = (typeof IMPORT_DOMAINS)[number];
export const IMPORT_BACKEND_DOMAINS = [...IMPORT_DOMAINS, "purchases"] as const;
export type BackendImportDomain = (typeof IMPORT_BACKEND_DOMAINS)[number];
export type ImportConflictMode = "skip" | "update";
export const IMPORT_MAX_ROWS: Record<BackendImportDomain, number> = { products: 500, employees: 100, ingredients: 500, purchases: 100 };
export const IMPORT_MAX_RECIPE_ROWS = 2000;
export const IMPORT_MAX_PURCHASE_LINES = 10000;
export const IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ZIP_BYTES = 3 * 1024 * 1024;
export const IMPORT_MAX_REQUEST_BYTES = 4 * 1024 * 1024 + 256 * 1024;
export const IMPORT_HEADERS = {
  ingredients: ["kode_bahan", "nama", "satuan", "stok_awal", "biaya_per_satuan(Rp)", "stok_minimum"],
  products: ["kode_produk", "nama", "kategori", "harga", "deskripsi"],
  recipes: ["kode_produk", "kode_bahan", "jumlah_per_porsi"],
  purchases: ["kode_pembelian", "tanggal", "pemasok", "catatan"],
  purchaseLines: ["kode_pembelian", "kode_bahan", "jumlah", "satuan", "biaya_per_satuan(Rp)"],
} as const;

export interface ImportTier { id: string; name: string; slug: string; header: string; }
export interface ProductImportMetadata {
  schema_version: 2; domain: "products"; company_id: string; outlet_id: string; tiers: ImportTier[];
}
export const IMPORT_METADATA_SHEET = "_rakku_import";
export const IMPORT_METADATA_KEYS = ["schema_version", "domain", "company_id", "outlet_id", "tiers"] as const;
export const tierHeader = (slug: string) => `harga_tier:${slug}`;
export const IMPORT_UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Metadata is an identity snapshot, never a positional mapping. Sort order may change safely. */
export function assertProductMetadata(metadata: ProductImportMetadata, companyId: string, outletId: string, current: ImportTier[]) {
  if (metadata.company_id !== companyId || metadata.outlet_id !== outletId) throw new Error("Template produk berasal dari perusahaan/outlet lain. Unduh template outlet tujuan.");
  if (metadata.tiers.length !== current.length || metadata.tiers.some(tier => !current.some(now =>
    now.id === tier.id && now.name === tier.name && now.slug === tier.slug && now.header === tier.header))) {
    throw new Error("Konfigurasi tier berubah (ditambah, dihapus, dinonaktifkan, diganti, atau diganti nama). Unduh template terbaru dan validasi ulang; harga tidak dipetakan ulang.");
  }
}
