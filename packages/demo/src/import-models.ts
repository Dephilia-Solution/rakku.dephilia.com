import type { DemoState } from "./models";

export type DemoImportDomain = "products" | "ingredients" | "employees" | "purchases";
export interface DemoImportIssue { field: string | null; message: string }
export interface DemoImportRow { rowNumber: number; payload: Record<string, unknown>; errors: DemoImportIssue[]; warnings: DemoImportIssue[] }
export interface DemoImportTier { id: string; name: string; slug: string; header: string }
export interface DemoImportMetadata { schema_version: 2; domain: "products"; company_id: string; outlet_id: string; tiers: DemoImportTier[] }
export interface DemoImportParsed {
  headerOk: boolean; headerLabels: string[]; rows: DemoImportRow[]; visibleSheets: string[];
  schemaVersion: 1 | 2; metadata?: DemoImportMetadata; structuralErrors: DemoImportIssue[];
}
export interface DemoImportContext {
  existingProductCodes?: Map<string, { id: string; code: string; name: string }>;
  existingProductNames?: Set<string>;
  existingIngredientCodes?: Map<string, { id: string; code: string; name: string; unit: string; is_active?: boolean }>;
  existingUsernames?: Set<string>;
  roleNameMap?: Map<string, { id: string; name: string }>;
  outletNameMap?: Map<string, { id: string; name: string }>;
  existingCategories?: Map<string, { id: string; name: string }>;
  companyId?: string; outletId?: string; tiers?: DemoImportTier[]; metadata?: DemoImportMetadata;
  existingTierPrices?: Map<string, number>;
}
/** Injected by Owner on first workbook invocation; the demo package has no spreadsheet dependency. */
export interface DemoWorkbookService {
  parseWorkbook(data: ArrayBuffer, domain: DemoImportDomain): DemoImportParsed;
  validateRows(domain: DemoImportDomain, rows: DemoImportRow[], context: DemoImportContext): void;
  applyPlanBudget(domain: DemoImportDomain, rows: DemoImportRow[], budget: number | null): void;
  buildTemplateWorkbook(domain: DemoImportDomain, categories?: string[], metadata?: DemoImportMetadata): Promise<Uint8Array>;
  fillSample?(bytes: Uint8Array, sheets: Record<string, unknown[][]>): Promise<Uint8Array>;
}
export interface DemoImportResult {
  imported: number; created: number; updated: number; skipped: number; recipes: number; categories_created: number;
  tier_prices: number; images: number;
  purchases: { reference: string; id: string | null; replayed: boolean; total_amount?: number }[]; replayed: boolean;
}
export interface DemoImportAsset {
  id: string; reference: string; content_hash: string; byte_size: number; width: number; height: number;
  state: "staged" | "attached" | "deleted"; url: string;
}
export interface DemoImportBatch {
  id: string; domain: DemoImportDomain; outlet_id: string | null; file_name: string;
  total_rows: number; valid_rows: number; error_rows: number; imported_rows: number;
  status: "validated" | "confirmed" | "failed"; schema_version: 1 | 2;
  created_at: string; confirmed_at: string | null; expires_at: string;
  created_by_owner_id: string; confirmed_by_owner_id: string | null;
  confirmation_options: { conflict_mode: "skip" | "update"; allow_new_categories: boolean } | null;
  confirmation_result: DemoImportResult | null;
  context: { linked: boolean; metadata: DemoImportMetadata | null; structural_errors: DemoImportIssue[]; image_summary: DemoImageSummary; timezone: string | null };
  rows: DemoImportRow[]; assets: DemoImportAsset[];
}
export interface DemoImageSummary { files: number; matched: number; unreferenced: number; rows: number; processed_bytes: number }
/** This object belongs to DemoSandbox, is transaction-cloned, and is never projected. */
export interface DemoImportBook {
  batches: DemoImportBatch[];
  references: { outlet_id: string; reference: string; signature: string; purchase_id: string }[];
  secretEmployeeIds: string[];
}
export type DemoImportCommand =
  | { type: "import.stage"; batch: DemoImportBatch }
  | { type: "import.confirm"; batch_id: string; conflict_mode: "skip" | "update"; allow_new_categories: boolean; image_urls?: Record<string, string> }
  | { type: "import.cleanup" };

export class DemoImportError extends Error {
  readonly name = "DemoImportError";
  constructor(message: string, readonly status = 400, readonly code = "IMPORT_INVALID") { super(message); }
}

/** Injected browser services can cross an ESM/CJS boundary in Node contract tests. */
export function isDemoImportError(error: unknown): error is DemoImportError {
  return error instanceof DemoImportError || error instanceof Error && error.name === "DemoImportError"
    && typeof (error as DemoImportError).code === "string" && Number.isInteger((error as DemoImportError).status);
}
export const importKey = (value: unknown) => String(value ?? "").trim().normalize("NFKC").toLocaleLowerCase("id-ID");
export const importKind = (domain: DemoImportDomain) => domain === "products" ? "product" : domain === "ingredients" ? "ingredient" : domain === "purchases" ? "purchase" : "employee";
export const importRowKind = (row: DemoImportRow, domain: DemoImportDomain) => String(row.payload.kind ?? importKind(domain));

/** Collision-free within one sandbox, including dynamically created entities. The generation
 * namespace also prevents a workbook from another visitor/reset from matching fixture IDs. */
export class DemoImportIdentities {
  #ids = new Map<string, string>();
  id(generation: string, kind: string, id: string): string {
    const key = JSON.stringify([generation, kind, id]);
    let value = this.#ids.get(key);
    if (!value) { value = crypto.randomUUID(); this.#ids.set(key, value); }
    return value;
  }
  clear() { this.#ids.clear(); }
}
export function importTiers(state: DemoState, outletId: string, identities: DemoImportIdentities): DemoImportTier[] {
  return state.tiers.filter(tier => tier.outlet_id === outletId && tier.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    .map(tier => ({ id: identities.id(state.generation, "tier", tier.id), name: tier.name, slug: tier.slug, header: `harga_tier:${tier.slug}` }));
}
export function importMetadata(state: DemoState, outletId: string, identities: DemoImportIdentities): DemoImportMetadata {
  return { schema_version: 2, domain: "products", company_id: identities.id(state.generation, "company", state.company.id),
    outlet_id: identities.id(state.generation, "outlet", outletId), tiers: importTiers(state, outletId, identities) };
}
export function assertDemoImportMetadata(state: DemoState, outletId: string, metadata: DemoImportMetadata | null, identities: DemoImportIdentities) {
  const current = importMetadata(state, outletId, identities);
  if (!metadata || metadata.company_id !== current.company_id || metadata.outlet_id !== current.outlet_id || metadata.tiers.length !== current.tiers.length
    || metadata.tiers.some(tier => !current.tiers.some(now => now.id === tier.id && now.name === tier.name && now.slug === tier.slug && now.header === tier.header))) {
    throw new DemoImportError("Konfigurasi tier berubah atau metadata outlet tidak sesuai. Unduh template terbaru dan validasi ulang; harga tidak dipetakan ulang.", 409, "IMPORT_TIERS_STALE");
  }
}
/** Same canonical payload as production importPurchaseHash, retained as a private string
 * instead of requiring Node crypto. Line order is irrelevant; header order is execution order. */
export function demoPurchaseSignature(header: DemoImportRow, rows: DemoImportRow[]) {
  const p = header.payload, upper = (value: unknown) => importKey(value).toLocaleUpperCase("id-ID");
  const details = rows.filter(row => row.payload.kind === "purchase_line" && importKey(row.payload.purchase_code) === importKey(p.code))
    .map(row => ({ ingredient_code: upper(row.payload.ingredient_code), quantity: Number(row.payload.quantity), unit: String(row.payload.unit), unit_cost: Number(row.payload.unit_cost) }))
    .sort((a, b) => a.ingredient_code < b.ingredient_code ? -1 : a.ingredient_code > b.ingredient_code ? 1 : 0);
  return JSON.stringify({ reference: upper(p.code), date: p.date, supplier: p.supplier ?? "", note: p.note ?? "", details });
}
