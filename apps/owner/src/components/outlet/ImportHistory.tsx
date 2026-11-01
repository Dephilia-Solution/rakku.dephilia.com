"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useMerchantRequest, useMerchantRuntime } from "@/lib/merchant-runtime";
import type { BackendImportDomain, ImportConflictMode } from "@/lib/import/import-spec";
import { readImportHistoryResponse, successfulImportHistory } from "@/lib/import/import-history-response";
import { groupImportPreviewRows } from "@/lib/import/import-preview-groups";
import { OwnerError, OwnerSection, OwnerSkeleton } from "@/components/ui/OwnerPrimitives";

// UI contracts shared with the live preview. Keep server-only Excel/image code out of this bundle.
export interface ImportIssue {
  field?: string | null;
  column?: string | number | null;
  sheet_name?: string;
  sheet_row?: number;
  row_number?: number;
  message: string;
}

export interface ImportPreviewRow {
  row_number: number;
  sheet_name?: string;
  sheet_row?: number;
  kind?: string;
  conflict?: boolean;
  code?: string;
  name?: string;
  values?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  errors: ImportIssue[];
  warnings?: ImportIssue[];
}

export interface ImportResult {
  imported?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  recipes?: number;
  categories_created?: number;
  tier_prices?: number;
  images?: number;
  replayed?: boolean;
  purchases?: { reference: string; id: string | null; replayed: boolean; total_amount?: number }[];
}

interface Batch {
  id: string;
  domain: BackendImportDomain;
  outlet_id: string | null;
  outlet_name?: string | null;
  file_name: string;
  total_rows?: number;
  valid_rows?: number;
  imported_rows: number;
  error_rows: number;
  status: string;
  created_at: string;
  confirmed_at?: string | null;
  expires_at?: string | null;
  schema_version?: number;
  context?: Record<string, unknown>;
  confirmation_options?: { conflict_mode?: ImportConflictMode; allow_new_categories?: boolean };
  confirmation_result?: ImportResult | null;
}

const SECONDARY = "owner-button owner-button--secondary min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const PAGE_SIZE = 25;
const LABELS: Record<string, string> = {
  code: "Kode bisnis", name: "Nama", username: "Username", category_name: "Kategori", price: "Harga dasar (Rp)",
  description: "Deskripsi", unit: "Satuan", expected_unit: "Satuan bahan (harus sama)", stock_quantity: "Stok awal",
  cost_per_unit: "Biaya per satuan (Rp)", min_stock_alert: "Stok minimum", product_code: "Kode produk",
  ingredient_code: "Kode bahan", ingredient_name: "Nama bahan", quantity_used: "Jumlah per porsi",
  purchase_code: "Kode pembelian", local_date: "Tanggal dari Excel", date: "Tanggal normalisasi (WIB)",
  supplier: "Pemasok", note: "Catatan", line_count: "Jumlah item", total_amount: "Total (Rp)", quantity: "Jumlah",
  unit_cost: "Biaya per satuan (Rp)", role_name: "Peran", outlet_names: "Outlet", tier_prices: "Pemetaan harga tier",
  header: "Kolom Excel", slug: "Slug tier", id: "ID", existing_price: "Harga tersimpan (Rp)", effective_price: "Harga efektif (Rp)",
  action: "Tindakan", image_reference: "Referensi gambar di ZIP", image_reference_normalized: "Referensi gambar normalisasi",
  image_mapping: "Pencocokan gambar", image_action: "Tindakan gambar", reference: "Referensi", status: "Status",
  width: "Lebar (px)", height: "Tinggi (px)", bytes: "Ukuran (byte)", conflict: "Kode sudah ada", purchase_replayed: "Pembelian identik sudah dicatat",
  category_is_new: "Kategori baru", sheet_name: "Sheet", sheet_row: "Baris sheet", kind: "Jenis baris",
  tiers: "Tier outlet", images: "Ringkasan gambar", files: "File dalam ZIP", matched: "Gambar cocok dan siap",
  unreferenced: "Gambar tidak dirujuk", rows: "Baris merujuk gambar", processed_bytes: "Total hasil kompresi (byte)",
  file_name: "Nama file", schema_version: "Versi schema", expires_at: "Berlaku sampai", confirmation_options: "Pilihan konfirmasi",
};
const ACTIONS: Record<string, string> = {
  set: "Simpan harga dari Excel", preserve: "Pertahankan nilai tersimpan", base_price_fallback: "Gunakan harga dasar (fallback)",
  preserve_or_fallback: "Pertahankan harga tersimpan / gunakan harga dasar", attach: "Pasang gambar dari ZIP",
  matched: "Referensi cocok", ready: "Siap, sudah diproses", invalid: "Gagal diproses", missing: "Tidak ditemukan",
};

export function importRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Defense in depth: never render/export employee PINs, including nested history payloads. */
export function safeImportValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeImportValue);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([field]) => !/^(pin|pin_hash|pinHash)$/i.test(field)).map(([field, item]) => [field, safeImportValue(item)]));
  return value;
}

export function normalizeImportRows(rows: ImportPreviewRow[] = []): ImportPreviewRow[] {
  return rows.map(row => {
    const values = importRecord(safeImportValue(row.values ?? row.payload ?? {}));
    return {
      ...row, payload: undefined, values, errors: row.errors ?? [], warnings: row.warnings ?? [],
      sheet_name: row.sheet_name ?? (typeof values.sheet_name === "string" ? values.sheet_name : undefined),
      sheet_row: row.sheet_row ?? (typeof values.sheet_row === "number" ? values.sheet_row : undefined),
      kind: row.kind ?? String(values.kind ?? ""), conflict: row.conflict ?? values.conflict === true,
      code: row.code || String(values.code ?? values.username ?? values.product_code ?? values.purchase_code ?? ""),
      name: row.name || String(values.name ?? values.ingredient_name ?? values.username ?? values.ingredient_code ?? ""),
    };
  });
}

export function saveImportBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.replace(/[\\/\x00-\x1f]/g, "_");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadImportErrors(rows: ImportPreviewRow[], structural: ImportIssue[] = [], filename = "laporan-kesalahan-impor.csv") {
  const quote = (value: unknown) => {
    let text = String(value ?? "");
    if (/^\s*[=+@\-]|^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const data: unknown[][] = [["Sheet", "Baris", "Kolom", "Jenis", "Kode bisnis", "Nama / Referensi", "Pesan", "Nilai normalisasi (tanpa PIN)"]];
  structural.forEach(issue => data.push([issue.sheet_name ?? "Workbook", issue.sheet_row ?? issue.row_number ?? "", issue.field ?? issue.column ?? "", "Struktur", "", "", issue.message, ""]));
  normalizeImportRows(rows).forEach(row => {
    for (const [kind, issues] of [["Kesalahan", row.errors], ["Peringatan", row.warnings ?? []]] as const) {
      issues.forEach(issue => data.push([issue.sheet_name ?? row.sheet_name ?? "Data", issue.sheet_row ?? row.sheet_row ?? row.row_number,
        issue.field ?? issue.column ?? "", kind, row.code, row.name, issue.message, JSON.stringify(row.values)]));
    }
  });
  saveImportBlob(new Blob(["\uFEFF", data.map(row => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }), filename);
}

export function ImportValues({ value }: { value: unknown }) {
  const safe = safeImportValue(value);
  if (safe === null || safe === undefined || safe === "") return <span className="text-on-surface-variant">Kosong</span>;
  if (typeof safe === "boolean") return <span>{safe ? "Ya" : "Tidak"}</span>;
  if (typeof safe !== "object") return <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{ACTIONS[String(safe)] ?? String(safe)}</span>;
  if (Array.isArray(safe)) return safe.length ? <ol className="space-y-3">{safe.map((item, index) => <li key={index} className="min-w-0 border-l-2 border-surface-container-high pl-3"><ImportValues value={item} /></li>)}</ol> : <span>Tidak ada</span>;
  return <dl className="space-y-2">{Object.entries(safe).map(([field, item]) => <div key={field} className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
    <dt className="text-on-surface-variant break-words">{LABELS[field] ?? field}</dt><dd className="min-w-0"><ImportValues value={item} /></dd>
  </div>)}</dl>;
}

export function ImportIssues({ issues, warning = false }: { issues: ImportIssue[]; warning?: boolean }) {
  if (!issues.length) return null;
  return <ul className={`space-y-1 text-sm ${warning ? "text-amber-800" : "text-error"}`}>
    {issues.map((issue, index) => <li key={index} className="break-words [overflow-wrap:anywhere]">
      <strong>{warning ? "Peringatan" : "Kesalahan"}</strong>
      {issue.sheet_name && ` · ${issue.sheet_name}`}{(issue.sheet_row ?? issue.row_number) !== undefined && ` · baris ${issue.sheet_row ?? issue.row_number}`}
      {(issue.field ?? issue.column) != null && ` · kolom ${issue.field ?? issue.column}`}: {issue.message}
    </li>)}
  </ul>;
}

export function importRowAction(row: ImportPreviewRow, domain: BackendImportDomain, mode: ImportConflictMode, existingProducts?: Set<string>, replayedPurchases?: Set<string>) {
  if (row.errors.length) return "error";
  const values = row.values ?? {};
  if (domain === "purchases") return values.purchase_replayed === true || (row.kind === "purchase" && row.conflict)
    || (row.kind === "purchase_line" && replayedPurchases?.has(String(values.purchase_code ?? "").trim().toLocaleUpperCase("id-ID"))) ? "skip" : "new";
  const existing = row.conflict || (row.kind === "recipe" && existingProducts?.has(String(values.product_code ?? "").trim().toLocaleUpperCase("id-ID")));
  return existing ? mode === "update" ? "update" : "skip" : "new";
}

const ACTION_LABEL = { error: "Perlu diperbaiki", new: "Baru", update: "Diperbarui", skip: "Dilewati" };

function ActionLabel({ action }: { action: keyof typeof ACTION_LABEL }) {
  const style = action === "error" ? "bg-error/10 text-error" : action === "skip" ? "bg-surface-container text-on-surface-variant" : "bg-primary/10 text-primary";
  return <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${style}`}>{ACTION_LABEL[action]}</span>;
}

function RowDetails({ row }: { row: ImportPreviewRow }) {
  return <details className="text-sm">
    <summary className="min-h-10 cursor-pointer py-2 font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Lihat data lengkap</summary>
    <ImportValues value={row.values} />
  </details>;
}

function CompactImportRow({ row, action, kind }: { row: ImportPreviewRow; action: keyof typeof ACTION_LABEL; kind: "recipe" | "purchase_line" }) {
  const values = row.values ?? {};
  const productComposition = kind === "recipe";
  const title = String(productComposition ? values.ingredient_name ?? values.ingredient_code ?? row.name : values.ingredient_name ?? values.ingredient_code ?? row.name ?? row.code);
  const unitCost = Number(values.unit_cost);
  const detail = productComposition
    ? `${String(values.quantity_used ?? "—")}${values.expected_unit ? ` ${String(values.expected_unit)}` : ""}`
    : `${String(values.quantity ?? "—")} ${String(values.unit ?? "")} · Rp ${Number.isFinite(unitCost) ? unitCost.toLocaleString("id-ID", { maximumFractionDigits: 2 }) : "—"}`;
  return <li className="min-w-0 space-y-1 border-l-2 border-surface-container-high pl-3">
    <div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-medium">{title}</p><p className="text-xs text-on-surface-variant">{detail}</p></div><ActionLabel action={action} /></div>
    <ImportIssues issues={row.errors} /><ImportIssues issues={row.warnings ?? []} warning />
    <RowDetails row={row} />
  </li>;
}

function ImportGroupCard({ group, domain, conflictMode, existingProducts, replayedPurchases }: {
  group: { key: string; main?: ImportPreviewRow; children: ImportPreviewRow[] };
  domain: BackendImportDomain; conflictMode: ImportConflictMode; existingProducts: Set<string>; replayedPurchases: Set<string>;
}) {
  const main = group.main;
  const row = main ?? group.children[0];
  if (!row) return null;
  const action = [main, ...group.children].some(item => item?.errors.length)
    ? "error" : importRowAction(row, domain, conflictMode, existingProducts, replayedPurchases);
  const values = row.values ?? {};
  const title = domain === "purchases"
    ? String(values.code ?? row.code ?? row.name ?? `Pembelian ${row.row_number}`)
    : String(row.name || row.code || `Baris ${row.sheet_row ?? row.row_number}`);
  const subtitle = domain === "purchases"
    ? [values.local_date ?? values.date, values.supplier].filter(Boolean).join(" · ")
    : [row.code, row.sheet_name && row.sheet_name !== "Produk" ? row.sheet_name : null].filter(Boolean).join(" · ");
  const errors = main?.errors ?? [];
  const warnings = main?.warnings ?? [];
  const isPurchase = domain === "purchases";
  const children = group.children.filter(child => child.kind === (isPurchase ? "purchase_line" : "recipe"));
  return <article className="min-w-0 space-y-3 p-3 sm:p-4" data-import-group={group.key}>
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0"><p className="break-words font-semibold">{title}</p>{subtitle && <p className="break-words text-xs text-on-surface-variant">{subtitle}</p>}</div>
      <ActionLabel action={action} />
    </div>
    {isPurchase && main && <p className="text-sm text-on-surface-variant">{children.length} item · Total Rp {Number(values.total_amount ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}{values.purchase_replayed === true ? " · Sudah pernah dicatat" : ""}</p>}
    {!!main?.values?.image_reference && <p className="break-words text-sm text-on-surface-variant">Gambar: {String(main.values.image_reference)} · {(() => {
      const mapping = importRecord(main.values.image_mapping);
      return ACTIONS[String(mapping.status)] ?? "Belum cocok";
    })()}</p>}
    <ImportIssues issues={errors} /><ImportIssues issues={warnings} warning />
    {children.length > 0 && <section className="space-y-2">
      <h5 className="text-xs font-semibold text-on-surface-variant">{isPurchase ? "Item pembelian" : "Komposisi"} · {children.length}</h5>
      <ul className="space-y-3">{children.map(child => <CompactImportRow key={`${child.kind}-${child.row_number}`} row={child}
        kind={isPurchase ? "purchase_line" : "recipe"} action={importRowAction(child, domain, conflictMode, existingProducts, replayedPurchases)} />)}</ul>
    </section>}
    {main && <RowDetails row={main} />}
  </article>;
}

export function ImportRowsPreview({ rows, domain, conflictMode = "skip" }: { rows: ImportPreviewRow[]; domain: BackendImportDomain; conflictMode?: ImportConflictMode }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | "issues">("all");
  const existingProducts = useMemo(() => new Set(rows.filter(row => row.kind === "product" && row.conflict).map(row => String(row.code).trim().toLocaleUpperCase("id-ID"))), [rows]);
  const replayedPurchases = useMemo(() => new Set(rows.filter(row => row.kind === "purchase" && row.values?.purchase_replayed === true).map(row => String(row.code).trim().toLocaleUpperCase("id-ID"))), [rows]);
  const groups = useMemo(() => groupImportPreviewRows(rows, domain), [rows, domain]);
  const hasIssues = (row: ImportPreviewRow) => row.errors.length > 0 || !!row.warnings?.length;
  const filtered = groups.flatMap(group => {
    const allRows = [group.main, ...group.children].filter((row): row is ImportPreviewRow => !!row);
    if (filter === "all") return [group];
    if (!allRows.some(hasIssues)) return [];
    const matchingChildren = group.children.filter(hasIssues);
    return [{ ...group, children: matchingChildren, main: group.main }];
  });
  const issueCount = rows.filter(hasIssues).length;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, pages - 1);
  const regionRef = useRef<HTMLDivElement>(null);
  const changePage = (next: number) => { setPage(next); regionRef.current?.focus(); };
  const setView = (view: "all" | "issues") => { setFilter(view); setPage(0); };
  return <div ref={regionRef} tabIndex={-1} className="min-w-0 space-y-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-label="Pratinjau impor">
    <div className="flex flex-wrap gap-2" aria-label="Filter pratinjau">
      <button type="button" aria-pressed={filter === "all"} onClick={() => setView("all")} className={`${SECONDARY} ${filter === "all" ? "border-primary text-primary" : ""}`}>Semua · {groups.length}</button>
      <button type="button" aria-pressed={filter === "issues"} onClick={() => setView("issues")} className={`${SECONDARY} ${filter === "issues" ? "border-error text-error" : ""}`}>Perlu ditinjau · {issueCount}</button>
    </div>
    <p role="status" className="text-xs text-on-surface-variant">{filtered.length ? `${activePage * PAGE_SIZE + 1}–${Math.min((activePage + 1) * PAGE_SIZE, filtered.length)} dari ${filtered.length}` : "Tidak ada baris bermasalah."}</p>
    <div className="divide-y divide-surface-container overflow-hidden rounded-xl border border-surface-container">
      {filtered.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE).map(group => <ImportGroupCard key={group.key} group={group} domain={domain} conflictMode={conflictMode} existingProducts={existingProducts} replayedPurchases={replayedPurchases} />)}
    </div>
    {pages > 1 && <nav className="flex flex-wrap items-center justify-between gap-2" aria-label="Halaman pratinjau impor">
      <button type="button" className={SECONDARY} disabled={activePage === 0} onClick={() => changePage(activePage - 1)}>Sebelumnya</button>
      <span className="text-sm">{activePage + 1} / {pages}</span>
      <button type="button" className={SECONDARY} disabled={activePage + 1 >= pages} onClick={() => changePage(activePage + 1)}>Berikutnya</button>
    </nav>}
  </div>;
}

export function ImportResultSummary({ result }: { result: ImportResult }) {
  const [page, setPage] = useState(0);
  const counts: [string, number | undefined][] = [["Diimpor", result.imported], ["Baru", result.created], ["Diperbarui", result.updated], ["Dilewati", result.skipped],
    ["Gagal", result.failed], ["Komposisi", result.recipes], ["Kategori dibuat", result.categories_created], ["Harga tier disimpan", result.tier_prices], ["Gambar terpasang", result.images]];
  const purchases = result.purchases ?? [];
  const pages = Math.max(1, Math.ceil(purchases.length / PAGE_SIZE));
  const activePage = Math.min(page, pages - 1);
  return <div className="space-y-3">
    {result.replayed && <p className="rounded-lg bg-primary/5 p-3 text-sm">Impor ini sudah diproses. Data tidak ditambahkan lagi.</p>}
    <dl className="flex flex-wrap gap-2">{counts.filter(([label, value]) => value !== undefined && (value !== 0 || label === "Diimpor")).map(([label, value]) => <div key={label} className="rounded-lg bg-surface-container-low px-3 py-2"><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}</dl>
    {purchases.length > 0 && <div className="space-y-2"><h4 className="text-sm font-semibold">Hasil pembelian ({purchases.length})</h4>
      {purchases.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE).map((purchase, index) => <div key={`${purchase.reference}-${index}`} className="rounded-lg border border-surface-container p-3 text-sm">
        <p className="break-words font-semibold">{purchase.reference} · {purchase.replayed ? "Sudah dicatat / dilewati" : "Dicatat baru"}</p>
        <p className="break-all text-on-surface-variant">ID pembelian: {purchase.id ?? "Tidak tersedia"}</p>
        {purchase.total_amount !== undefined && <p>Total Rp {Number(purchase.total_amount).toLocaleString("id-ID", { maximumFractionDigits: 2 })}</p>}
      </div>)}
      {pages > 1 && <nav className="flex flex-wrap items-center justify-between gap-2" aria-label="Halaman hasil pembelian"><button type="button" className={SECONDARY} disabled={!activePage} onClick={() => setPage(activePage - 1)}>Sebelumnya</button><span className="text-sm">{activePage + 1} / {pages}</span><button type="button" className={SECONDARY} disabled={activePage + 1 >= pages} onClick={() => setPage(activePage + 1)}>Berikutnya</button></nav>}
    </div>}
  </div>;
}

export default function ImportHistory(props: { domain: BackendImportDomain; outletId?: string }) {
  return <ScopedImportHistory key={`${props.domain}:${props.outletId ?? "company"}`} {...props} />;
}

function ScopedImportHistory({ domain, outletId }: { domain: BackendImportDomain; outletId?: string }) {
  const request = useMerchantRequest();
  const isDemo = !!useMerchantRuntime();
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ batch: Batch; rows: ImportPreviewRow[] } | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const alive = useRef(false);
  const listRequest = useRef<{ generation: number; controller?: AbortController; pending: boolean }>({ generation: 0, pending: false });
  const detailRequest = useRef<{ generation: number; controller?: AbortController }>({ generation: 0 });
  const detailFocus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRequest.current;
    const detail = detailRequest.current;
    alive.current = true;
    return () => { alive.current = false; list.generation++; detail.generation++; list.controller?.abort(); detail.controller?.abort(); };
  }, []);

  const load = async () => {
    if (listRequest.current.pending || (domain !== "employees" && !outletId)) return;
    const state = listRequest.current;
    state.controller?.abort(); state.controller = new AbortController(); state.pending = true;
    const generation = ++state.generation;
    const active = () => alive.current && generation === state.generation && !state.controller?.signal.aborted;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ domain });
      if (domain !== "employees" && outletId) params.set("outlet_id", outletId);
      const response = await request(`/api/owner/import/batches?${params}`, { signal: state.controller.signal, cache: "no-store" });
      const data = await readImportHistoryResponse<{ batches?: Batch[]; error?: string }>(response);
      if (!active()) return;
      if (!response.ok) throw new Error(data.error ?? "Gagal memuat riwayat impor.");
      setBatches(successfulImportHistory(data.batches ?? []).filter(batch => batch.domain === domain && (domain === "employees" || batch.outlet_id === outletId)));
    } catch (cause) { if (active()) setError(cause instanceof Error ? cause.message : "Gagal memuat riwayat impor."); }
    finally { if (active()) { state.pending = false; setLoading(false); } }
  };

  const showDetail = async (id: string) => {
    const state = detailRequest.current;
    state.controller?.abort(); state.controller = new AbortController();
    const generation = ++state.generation;
    const active = () => alive.current && generation === state.generation && !state.controller?.signal.aborted;
    setSelected(id); setDetail(null); setDetailError(""); setDetailLoading(true);
    try {
      const params = new URLSearchParams({ batch_id: id });
      const response = await request(`/api/owner/import/batches?${params}`, { signal: state.controller.signal, cache: "no-store" });
      const data = await readImportHistoryResponse<{ batch?: Batch; rows?: ImportPreviewRow[]; error?: string }>(response);
      if (!active()) return;
      if (!response.ok || !data.batch) throw new Error(data.error ?? "Gagal memuat detail batch.");
      if (data.batch.domain !== domain || (domain !== "employees" && data.batch.outlet_id !== outletId)) throw new Error("Batch bukan milik jenis impor atau outlet yang sedang dibuka.");
      setDetail({ batch: data.batch, rows: normalizeImportRows(data.rows) });
    } catch (cause) { if (active()) setDetailError(cause instanceof Error ? cause.message : "Gagal memuat detail batch."); }
    finally { if (active()) { setDetailLoading(false); requestAnimationFrame(() => { if (active()) detailFocus.current?.focus(); }); } }
  };

  const closeDetail = () => { detailRequest.current.generation++; detailRequest.current.controller?.abort(); setSelected(null); setDetail(null); setDetailLoading(false); };
  const hasIssues = detail?.rows.some(row => row.errors.length || row.warnings?.length);
  const structural = Array.isArray(detail?.batch.context?.structural_errors) ? detail.batch.context.structural_errors as ImportIssue[] : [];
  return <details className="min-w-0 border-t border-surface-container pt-4" onToggle={event => { setOpen(event.currentTarget.open); if (event.currentTarget.open) void load(); }}>
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Riwayat impor</summary>
    {open && <div className="mt-3 min-w-0 space-y-4">
      {isDemo && <p className="text-sm text-on-surface-variant">Riwayat simulasi di memori sesi demo. Tidak ada unggahan atau penyimpanan produksi.</p>}
      {domain !== "employees" && !outletId ? <p className="text-sm">Pilih outlet untuk melihat riwayatnya.</p> : <>
         <button type="button" className={SECONDARY} disabled={loading} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" />Muat ulang</button>
        {error && <OwnerError message={error} retry={() => void load()} />}
        {loading ? <OwnerSkeleton rows={2} /> : <div className="divide-y divide-surface-container">
          {!batches.length && !error && <p className="py-3 text-sm text-on-surface-variant">Belum ada riwayat impor.</p>}
          {batches.map(batch => <div key={batch.id} className="min-w-0 space-y-2 py-3 text-sm">
            <h3 className="break-words font-semibold [overflow-wrap:anywhere]">{batch.file_name}</h3>
            <p className="text-on-surface-variant">{new Date(batch.created_at).toLocaleString("id-ID")} · {batch.status === "confirmed" ? `${batch.imported_rows} diimpor` : batch.status === "validated" ? "Sudah divalidasi" : batch.status === "expired" ? "Kedaluwarsa" : batch.status}</p>
            <p className="text-xs text-on-surface-variant">{batch.total_rows ?? "—"} baris · {batch.error_rows} baris bermasalah{batch.expires_at && batch.status === "validated" ? ` · Berlaku sampai ${new Date(batch.expires_at).toLocaleString("id-ID")}` : ""}</p>
            <button type="button" className={SECONDARY} aria-expanded={selected === batch.id} onClick={() => selected === batch.id ? closeDetail() : void showDetail(batch.id)}>{selected === batch.id ? "Tutup" : "Detail"}</button>
          </div>)}
        </div>}
        {selected && <div ref={detailFocus} tabIndex={-1} aria-busy={detailLoading} className="min-w-0 space-y-3 rounded-xl border border-surface-container p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:p-4">
          <h3 className="text-base font-semibold">Detail batch</h3>
          {detailLoading && <><p role="status" className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" aria-hidden="true" />Memuat nilai dan hasil batch…</p><OwnerSkeleton rows={2} /></>}
          {detailError && <OwnerError message={detailError} retry={() => void showDetail(selected)} />}
          {detail && <>
            <p className="break-all text-xs text-on-surface-variant">Batch: {detail.batch.id}</p>
            <ImportValues value={{ file_name: detail.batch.file_name, outlet: detail.batch.outlet_name, schema_version: detail.batch.schema_version, expires_at: detail.batch.expires_at, confirmation_options: detail.batch.confirmation_options }} />
            {detail.batch.confirmation_result && <OwnerSection title="Hasil konfirmasi"><ImportResultSummary result={detail.batch.confirmation_result} /></OwnerSection>}
            {detail.batch.context && <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-primary">Metadata, tier & konteks batch</summary><div className="py-2 text-sm"><ImportValues value={detail.batch.context} /></div></details>}
            <ImportIssues issues={structural} />
            {(hasIssues || structural.length > 0) && <button type="button" className={SECONDARY} onClick={() => downloadImportErrors(detail.rows, structural)}><Download size={16} aria-hidden="true" />Unduh laporan kesalahan & peringatan CSV</button>}
            <ImportRowsPreview key={detail.batch.id} rows={detail.rows} domain={domain} conflictMode={detail.batch.confirmation_options?.conflict_mode ?? "skip"} />
          </>}
        </div>}
      </>}
    </div>}
  </details>;
}
