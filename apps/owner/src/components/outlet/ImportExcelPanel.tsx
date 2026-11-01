"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, RefreshCw, X } from "lucide-react";
import ImportHistory, {
  downloadImportErrors, importRowAction, ImportIssues, ImportResultSummary, ImportRowsPreview,
  normalizeImportRows, saveImportBlob, type ImportIssue, type ImportPreviewRow, type ImportResult,
} from "./ImportHistory";
import { useMerchantRequest, useMerchantRuntime } from "@/lib/merchant-runtime";
import { usePlan } from "@/components/billing/PlanProvider";
import { OwnerError, OwnerSection } from "@/components/ui/OwnerPrimitives";
import {
  IMPORT_MAX_FILE_BYTES, IMPORT_MAX_ZIP_BYTES, IMPORT_MAX_REQUEST_BYTES, IMPORT_MAX_ROWS,
  type BackendImportDomain, type ImportConflictMode, type ImportTier, type ProductImportMetadata,
} from "@/lib/import/import-spec";

export interface ImportValidationResponse {
  error?: string;
  code?: string;
  batch_id?: string;
  schema_version?: number;
  metadata?: ProductImportMetadata | null;
  expires_at?: string;
  expires_in_seconds?: number;
  can_confirm?: boolean;
  structural_errors?: ImportIssue[];
  errors?: ImportIssue[];
  warnings?: ImportIssue[];
  assets?: Record<string, unknown>[];
  summary?: {
    total?: number;
    main_total?: number;
    valid?: number;
    errors?: number;
    warnings?: number;
    max_rows?: number;
    limit_used?: string | null;
    limit_note?: string | null;
    linked_errors?: number;
    can_confirm?: boolean;
    new_ingredients?: number;
    existing_ingredients?: number;
    recipes?: number;
    conflicts?: number;
    inserted?: number;
    new_categories?: string[];
    new_categories_for_insert?: string[];
    new_categories_for_update?: string[];
    purchase_replays?: number;
    purchase_lines?: number;
    tier_prices?: number;
    tiers?: ImportTier[];
    images?: Record<string, unknown>;
  };
  rows?: ImportPreviewRow[];
  sheet_max_note?: string | null;
}

interface Props {
  domain: BackendImportDomain;
  outletId?: string;
  outletName?: string;
  onClose: () => void;
  onImported?: () => void;
}

const DOMAIN_LABEL: Record<BackendImportDomain, string> = { products: "Produk", employees: "Karyawan", ingredients: "Bahan Baku", purchases: "Pembelian" };
const SECONDARY = "owner-button owner-button--secondary min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const PRIMARY = "owner-button owner-button--primary min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const ZIP_MAX_BYTES = IMPORT_MAX_ZIP_BYTES;
type Phase = "download" | "choose" | "validate" | "preview" | "confirm" | "result";
const REVALIDATE_CODES = new Set(["IMPORT_EXPIRED", "IMPORT_TIERS_STALE", "IMPORT_STRUCTURE_INVALID", "IMPORT_REFERENCE_INVALID", "IMPORT_LINKED_ERRORS", "IMPORT_CATEGORY_CONFIRMATION_REQUIRED", "IMPORT_SCHEMA_NOT_READY"]);

function recoveryMessage(code?: string) {
  if (code === "IMPORT_EXPIRED") return "Preview sudah kedaluwarsa. Pilih Validasi ulang untuk membuat batch baru sebelum menyimpan.";
  if (code === "IMPORT_TIERS_STALE") return "Tier atau identitas outlet/template berubah. Unduh template terbaru, pindahkan nilai ke header tier yang sesuai, lalu pilih dan validasi file baru. Harga tidak dipetakan ulang berdasarkan urutan kolom.";
  if (code === "IMPORT_STRUCTURE_INVALID") return "Perbaiki nama sheet dan header sesuai template terbaru, lalu pilih file yang telah diperbaiki dan validasi ulang.";
  if (code === "IMPORT_CATEGORY_CONFIRMATION_REQUIRED") return "Kategori outlet berubah sejak validasi. Validasi ulang untuk melihat daftar kategori terbaru dan berikan persetujuan kembali.";
  if (code === "IMPORT_SCHEMA_NOT_READY") return "Database belum memiliki schema import terbaru. Admin perlu memastikan migrasi 0019_comprehensive_imports.sql sudah diterapkan. Setelah itu validasi ulang file yang sama; file belum tersimpan.";
  if (code === "IMPORT_REFERENCE_INVALID" || code === "IMPORT_LINKED_ERRORS") return "Data referensi atau sheet terkait berubah/tidak valid. Periksa kesalahan, perbaiki file bila diperlukan, lalu validasi ulang.";
  if (code === "IMPORT_BUSY") return "Batch atau gambar masih diproses. Tunggu sebentar, lalu coba konfirmasi lagi dengan batch yang sama.";
  return null;
}

async function readResponse(response: Response): Promise<ImportValidationResponse & ImportResult> {
  try { return await response.json() as ImportValidationResponse & ImportResult; }
  catch { throw new Error("Respons layanan impor tidak dapat dibaca. Periksa koneksi lalu coba lagi."); }
}

export default function ImportExcelPanel(props: Props) {
  // A changed destination must never reuse a preview, consent, or a late request from the old outlet.
  return <ScopedImportExcelPanel key={`${props.domain}:${props.outletId ?? "company"}`} {...props} />;
}

function ScopedImportExcelPanel({ domain, outletId, outletName, onClose, onImported }: Props) {
  const request = useMerchantRequest();
  const isDemo = !!useMerchantRuntime();
  const { openUpgrade } = usePlan();
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const excelInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const alive = useRef(false);
  const operation = useRef<{ generation: number; controller?: AbortController; pending: boolean }>({ generation: 0, pending: false });
  const closed = useRef(false);
  const [phase, setPhase] = useState<Phase>("download");
  const [pending, setPending] = useState<"download" | "validate" | "confirm" | null>(null);
  const [excel, setExcel] = useState<File | null>(null);
  const [imagesZip, setImagesZip] = useState<File | null>(null);
  const [validation, setValidation] = useState<ImportValidationResponse | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preflightIssues, setPreflightIssues] = useState<{sheet:string;row:number;field?:string;message:string}[]>([]);
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [planLimit, setPlanLimit] = useState<string | null>(null);
  const [needsValidation, setNeedsValidation] = useState(false);
  const [conflictMode, setConflictMode] = useState<ImportConflictMode>("skip");
  const [allowNewCategories, setAllowNewCategories] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const hasOutlet = domain === "employees" || !!outletId;
  const rows = useMemo(() => normalizeImportRows(validation?.rows), [validation?.rows]);
  const summary = validation?.summary;
  const structural = [...(validation?.structural_errors ?? []), ...(validation?.errors ?? [])];
  const mainKind = domain === "products" ? "product" : domain === "ingredients" ? "ingredient" : domain === "purchases" ? "purchase" : "employee";
  const mainRows = rows.filter(row => !row.kind || row.kind === mainKind);
  const existingProducts = new Set(rows.filter(row => row.kind === "product" && row.conflict).map(row => String(row.code).trim().toLocaleUpperCase("id-ID")));
  const actions = mainRows.map(row => importRowAction(row, domain, conflictMode, existingProducts));
  const newCount = mainRows.length ? actions.filter(action => action === "new").length : summary?.inserted ?? 0;
  const updateCount = actions.filter(action => action === "update").length;
  const skipCount = actions.filter(action => action === "skip").length;
  const recipeCount = domain === "products" ? rows.filter(row => row.kind === "recipe" && !["skip", "error"].includes(importRowAction(row, domain, conflictMode, existingProducts))).length : 0;
  const conflicts = summary?.conflicts ?? mainRows.filter(row => row.conflict && !row.errors.length).length;
  const categoriesForInsert = summary?.new_categories_for_insert ?? mainRows.filter(row => !row.conflict && !row.errors.length && row.values?.category_is_new).map(row => String(row.values?.category_name ?? ""));
  const categoriesForUpdate = summary?.new_categories_for_update ?? mainRows.filter(row => row.conflict && !row.errors.length && row.values?.category_is_new).map(row => String(row.values?.category_name ?? ""));
  const newCategories = domain === "products" ? [...new Set([
    ...categoriesForInsert, ...(conflictMode === "update" ? categoriesForUpdate : []),
    ...(!mainRows.length && !conflicts ? summary?.new_categories ?? [] : []),
  ])].filter(Boolean) : [];
  const errorRows = rows.filter(row => row.errors.length).length;
  const serverBlocked = !validation?.batch_id || validation.can_confirm === false || summary?.can_confirm === false || (summary?.linked_errors ?? 0) > 0 || structural.length > 0;
  // A replay-only purchase batch is still confirmable: the server returns the original purchase IDs.
  const hasWork = newCount + updateCount + recipeCount > 0 || domain === "purchases" && (skipCount > 0 || (summary?.purchase_replays ?? 0) > 0);
  const canConfirm = hasOutlet && !serverBlocked && !needsValidation && !expired && hasWork && (!newCategories.length || allowNewCategories);
  const hasIssues = structural.length > 0 || !!validation?.warnings?.length || rows.some(row => row.errors.length || row.warnings?.length);

  useEffect(() => {
    const state = operation.current;
    alive.current = true;
    headingRef.current?.focus();
    return () => { alive.current = false; state.generation++; state.controller?.abort(); };
  }, []);

  useEffect(() => {
    if (!expiresAt || result) return;
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (!Number.isFinite(remaining)) return;
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [expiresAt, result]);

  useEffect(() => { headingRef.current?.focus(); }, [phase]);

  const begin = (kind: "download" | "validate" | "confirm") => {
    if (operation.current.pending || closed.current) return null;
    const state = operation.current;
    state.controller?.abort(); state.controller = new AbortController(); state.pending = true;
    const generation = ++state.generation;
    setPending(kind); setError(null); setPlanLimit(null); setErrorCode(undefined);
    return { signal: state.controller.signal, active: () => alive.current && !closed.current && generation === state.generation && !state.controller?.signal.aborted,
      finish: () => { if (alive.current && generation === state.generation && !closed.current) { state.pending = false; setPending(null); } } };
  };

  const invalidateOperation = () => { operation.current.generation++; operation.current.controller?.abort(); operation.current.pending = false; setPending(null); };
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    operation.current.generation++; operation.current.controller?.abort();
    // Existing consumers refresh AND dismiss in this callback. Defer it until explicit close.
    try { if (result) onImported?.(); } finally { onClose(); }
  };

  const reportFailure = (data: ImportValidationResponse, fallback: string) => {
    setError(data.error ?? fallback); setErrorCode(data.code);
    if (data.code === "PLAN_LIMIT") setPlanLimit(data.error ?? "Kuota atau fitur paket belum mendukung impor ini.");
  };

  const downloadTemplate = async (sample = false) => {
    if (!hasOutlet) { setError("Pilih outlet tujuan sebelum mengunduh template."); return; }
    const task = begin("download"); if (!task) return;
    try {
      const params = new URLSearchParams({ domain });
      if (domain !== "employees" && outletId) params.set("outlet_id", outletId);
      if (sample) params.set("sample", "1");
      const response = await request(`/api/owner/import/template?${params}`, { signal: task.signal, cache: "no-store" });
      if (!response.ok) {
        const data = await readResponse(response);
        if (task.active()) reportFailure(data, "Gagal mengunduh template.");
        return;
      }
      const blob = await response.blob();
      if (!task.active()) return;
      if (!blob.size || response.headers.get("content-type")?.includes("application/json")) throw new Error("Layanan belum mengembalikan file Excel. Coba unduh kembali.");
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? `${sample ? "contoh" : "template"}-impor-${domain}.xlsx`;
      saveImportBlob(blob, filename);
      if (!validation) setPhase("choose");
    } catch (cause) { if (task.active()) setError(cause instanceof Error ? cause.message : "Gagal mengunduh template."); }
    finally { task.finish(); }
  };

  const clearPreview = () => {
    setValidation(null); setResult(null); setNeedsValidation(false); setExpiresAt(null); setExpired(false);
    setConflictMode("skip"); setAllowNewCategories(false); setError(null); setErrorCode(undefined); setPlanLimit(null); setPreflightIssues([]);
  };

  const chooseFile = (file: File | null, zip: boolean) => {
    if (operation.current.pending || !file) return;
    clearPreview(); setPhase("choose");
    const limit = zip ? ZIP_MAX_BYTES : IMPORT_MAX_FILE_BYTES;
    if (!file.size || !(zip ? /\.zip$/i : /\.xlsx$/i).test(file.name) || file.size > limit) {
      if (zip) setImagesZip(null); else setExcel(null);
      setError(zip ? "Pilih ZIP gambar yang tidak kosong, maksimal 3 MB." : "Pilih file Excel .xlsx yang tidak kosong, maksimal 2 MB.");
      return;
    }
    if (zip) setImagesZip(file); else setExcel(file);
  };

  const validate = async () => {
    if (!excel || !hasOutlet) { setError("Pilih file Excel dan outlet tujuan terlebih dahulu."); return; }
    if (excel.size + (imagesZip?.size ?? 0) > IMPORT_MAX_REQUEST_BYTES - 256 * 1024) { setError("Total Excel dan ZIP maksimal 4 MB. Pecah file menjadi beberapa batch."); return; }
    const task = begin("validate"); if (!task) return;
    clearPreview(); setPreflightIssues([]); setPhase("validate");
    try {
      const { preflightImportWorkbook } = await import("@/lib/import/import-preflight");
      if(!task.active())return;
      const preflight=await preflightImportWorkbook(excel,domain);
      if(!task.active())return;
      if(preflight.issues.length){setPreflightIssues(preflight.issues);setError(`Validasi awal menemukan ${preflight.issues.length} masalah. File belum dikirim; periksa sheet/baris di bawah.`);setPhase("choose");return;}
      if(imagesZip){const signature=new Uint8Array(await imagesZip.slice(0,4).arrayBuffer());if(!task.active())return;
        if(signature[0]!==0x50||signature[1]!==0x4b){setError("File gambar tidak memiliki signature ZIP yang valid.");setPhase("choose");return;}}
      const form = new FormData(); form.append("domain", domain); form.append("file", excel);
      if (domain !== "employees" && outletId) form.append("outlet_id", outletId);
      if (domain === "products" && imagesZip) form.append("images_zip", imagesZip);
      const response = await request("/api/owner/import/validate", { method: "POST", body: form, signal: task.signal });
      const data = await readResponse(response);
      if (!task.active()) return;
      // 400/409 can carry structured rows/issues. Keep these in the preview even without a batch ID.
      setValidation(data); setPhase("preview"); setHistoryRevision(value => value + 1);
      if (!response.ok) { reportFailure(data, "Gagal memvalidasi file."); setNeedsValidation(true); return; }
      if (!data.batch_id && data.can_confirm !== false && data.summary?.can_confirm !== false) { setError("Layanan tidak mengembalikan identitas batch. Validasi ulang sebelum menyimpan."); setNeedsValidation(true); }
      setExpiresAt(data.expires_at ?? (data.expires_in_seconds ? new Date(Date.now() + data.expires_in_seconds * 1000).toISOString() : null));
    } catch (cause) {
      if (task.active()) { setPhase("choose"); setError(cause instanceof Error ? cause.message : "Gagal memvalidasi file. Coba lagi."); }
    } finally { task.finish(); }
  };

  const confirm = async () => {
    if (!canConfirm || !validation?.batch_id || operation.current.pending || phase !== "confirm") return;
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) { setExpired(true); return; }
    const task = begin("confirm"); if (!task) return;
    // Retry deliberately retains this batch ID; the backend owns transaction/replay identity.
    const batchId = validation.batch_id;
    try {
      const response = await request("/api/owner/import/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: task.signal,
        body: JSON.stringify({ batch_id: batchId, conflict_mode: domain === "purchases" ? "skip" : conflictMode, allow_new_categories: allowNewCategories }),
      });
      const data = await readResponse(response);
      if (!task.active()) return;
      if (!response.ok) {
        reportFailure(data, "Konfirmasi belum berhasil. Coba kembali dengan batch yang sama.");
        if (data.rows || data.structural_errors || data.errors) setValidation(previous => previous ? { ...previous, ...data, batch_id: batchId, summary: { ...previous.summary, ...data.summary } } : previous);
        if (REVALIDATE_CODES.has(data.code ?? "")) { setNeedsValidation(true); setAllowNewCategories(false); setPhase("preview"); }
        return;
      }
      if (typeof data.imported !== "number") throw new Error("Hasil konfirmasi belum dapat dibaca. Coba konfirmasi lagi dengan batch yang sama untuk mengambil hasilnya.");
      setResult(data); setPhase("result"); setHistoryRevision(value => value + 1);
    } catch (cause) {
      if (task.active()) setError(`${cause instanceof Error ? cause.message : "Koneksi terputus saat konfirmasi."} Coba konfirmasi lagi; batch yang sama digunakan untuk mengambil hasil tanpa menggandakan data.`);
    } finally { task.finish(); }
  };

  const cancelValidation = () => { invalidateOperation(); setPhase("choose"); setError("Permintaan validasi dibatalkan. Anda dapat memvalidasi lagi; belum ada konfirmasi penyimpanan."); };
  const changeMode = (mode: ImportConflictMode) => {
    if (operation.current.pending) return;
    setConflictMode(mode); setAllowNewCategories(false);
    if (phase === "confirm") setPhase("preview");
  };
  const changeConsent = (allowed: boolean) => { if (operation.current.pending) return; setAllowNewCategories(allowed); if (phase === "confirm") setPhase("preview"); };
  const editFiles = () => { if (operation.current.pending) return; clearPreview(); setPhase("choose"); };
  const recovery = recoveryMessage(errorCode);
  const busyMessage = pending === "download" ? "Menyiapkan template…" : pending === "validate"
    ? "Memeriksa file dan menyiapkan pratinjau…" : "Menyimpan data…";
  const warningCount = summary?.warnings ?? rows.reduce((sum, row) => sum + (row.warnings?.length ?? 0), 0);
  const previewMetrics: [string, number][] = [
    [DOMAIN_LABEL[domain], summary?.main_total ?? mainRows.length],
    ...(newCount ? [["Baru", newCount] as [string, number]] : []),
    ...(updateCount ? [["Diperbarui", updateCount] as [string, number]] : []),
    ...(skipCount ? [["Dilewati", skipCount] as [string, number]] : []),
    ...((summary?.errors ?? errorRows) ? [["Bermasalah", summary?.errors ?? errorRows] as [string, number]] : []),
    ...(warningCount ? [["Peringatan", warningCount] as [string, number]] : []),
    ...(domain === "products" && (summary?.recipes ?? 0) ? [["Komposisi", summary?.recipes ?? 0] as [string, number]] : []),
    ...(domain === "purchases" && (summary?.purchase_lines ?? 0) ? [["Item", summary?.purchase_lines ?? 0] as [string, number]] : []),
  ];

  // Remain inline: callers can already be inside a sheet. History/details never create another portal.
  return <section aria-labelledby={`${id}-title`} className="min-w-0 overflow-hidden rounded-2xl border border-surface-container bg-surface-container-lowest text-on-surface">
    <header className="flex items-start justify-between gap-3 border-b border-surface-container bg-surface-container-low p-4 sm:p-5">
      <div className="min-w-0"><h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">{phase === "result" ? "Hasil impor" : `Impor ${DOMAIN_LABEL[domain].toLocaleLowerCase("id-ID")}`}</h2>
        <p className="mt-1 break-words text-sm text-on-surface-variant">{domain === "employees" ? "Perusahaan ini" : outletName ?? "Pilih outlet"}</p>
      </div>
      <button type="button" onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-container-high active:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-label={pending === "confirm" ? "Tutup tampilan impor; proses server mungkin tetap berjalan" : "Tutup impor"}><X size={20} aria-hidden="true" /></button>
    </header>

    <div className="min-w-0 space-y-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
      {isDemo && <p role="note" className="rounded-lg bg-primary/5 p-3 text-sm">Mode demo: perubahan hanya berlaku di sesi simulasi.</p>}
      {!hasOutlet && <OwnerError message="Pilih outlet tujuan untuk mengunduh, memvalidasi, dan mengonfirmasi impor." />}
      {error && <OwnerError message={error} />}
      {preflightIssues.length>0&&<details open className="owner-panel space-y-3"><summary className="min-h-11 cursor-pointer font-semibold text-error">Kesalahan format awal · {preflightIssues.length}</summary><ul className="space-y-2">{preflightIssues.slice(0,100).map((issue,index)=><li key={`${issue.sheet}:${issue.row}:${index}`} className="break-words text-sm leading-relaxed [overflow-wrap:anywhere]"><strong>{issue.sheet} · baris {issue.row}{issue.field?` · ${issue.field}`:""}:</strong> {issue.message}</li>)}</ul>{preflightIssues.length>100&&<p className="text-xs text-on-surface-variant">Menampilkan 100 dari {preflightIssues.length} kesalahan format.</p>}<p className="text-xs text-on-surface-variant">File ini belum dikirim ke server. Validasi bisnis, referensi outlet, akses, harga, stok, dan kuota tetap diperiksa kembali di server setelah format diperbaiki.</p></details>}
      {recovery && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{recovery}</p>}
      {planLimit && <div className="space-y-2 rounded-lg border border-error/20 p-3"><p className="text-sm text-error">{planLimit}</p><button type="button" className={SECONDARY} onClick={() => openUpgrade("Pilih paket yang mendukung kapasitas dan fitur impor Anda.")}>Lihat paket upgrade</button></div>}
      {pending && <div role="status" aria-live="polite" className="space-y-2 rounded-xl bg-surface-container-low p-4"><p className="flex items-start gap-2 text-sm font-medium"><Loader2 size={20} className="shrink-0 animate-spin text-primary" aria-hidden="true" />{busyMessage}</p>
        {pending === "validate" && <button type="button" onClick={cancelValidation} className={SECONDARY}>Batalkan permintaan</button>}
        {pending === "confirm" && <p className="text-xs text-on-surface-variant">Jika koneksi terputus, cek riwayat sebelum mencoba lagi.</p>}
      </div>}

      {(phase === "download" || phase === "choose" || phase === "validate") && <OwnerSection title="File impor">
        <fieldset disabled={!!pending || !hasOutlet} className="space-y-4" aria-busy={pending === "validate"}>
          <div className="flex flex-wrap gap-2"><button type="button" className={SECONDARY} disabled={!!pending || !hasOutlet} onClick={() => void downloadTemplate()}><Download size={16} aria-hidden="true" />Unduh template</button>
            {isDemo && <button type="button" className={SECONDARY} disabled={!!pending || !hasOutlet} onClick={() => void downloadTemplate(true)}><Download size={16} aria-hidden="true" />Contoh terisi</button>}</div>
          <label htmlFor={`${id}-excel`} className="block space-y-2 text-sm"><span className="font-semibold">File Excel</span><input id={`${id}-excel`} ref={excelInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="block min-h-11 w-full min-w-0 rounded-lg border border-surface-container-high p-2 text-base file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:px-3 file:text-base" onChange={event => { chooseFile(event.target.files?.[0] ?? null, false); event.target.value = ""; }} /></label>
          {excel && <p className="break-words text-sm [overflow-wrap:anywhere]">Excel: <strong>{excel.name}</strong></p>}
          {domain === "products" && <><label htmlFor={`${id}-zip`} className="block space-y-2 text-sm"><span className="font-semibold">ZIP gambar <span className="font-normal text-on-surface-variant">(opsional)</span></span><input id={`${id}-zip`} ref={zipInput} type="file" accept=".zip,application/zip" className="block min-h-11 w-full min-w-0 rounded-lg border border-surface-container-high p-2 text-base file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:px-3 file:text-base" onChange={event => { chooseFile(event.target.files?.[0] ?? null, true); event.target.value = ""; }} /></label>
            {imagesZip && <p className="break-words text-sm [overflow-wrap:anywhere]">ZIP: <strong>{imagesZip.name}</strong> <button type="button" className="ml-2 text-primary underline" onClick={() => { setImagesZip(null); clearPreview(); }}>Hapus</button></p>}
          </>}
          <button type="button" className={PRIMARY} disabled={!excel || !!pending || !hasOutlet} onClick={() => void validate()}><FileSpreadsheet size={16} aria-hidden="true" />{isDemo ? "Validasi simulasi" : "Validasi & pratinjau"}</button>
          <details><summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-primary">Format & aturan file</summary><div className="space-y-2 pt-2 text-sm text-on-surface-variant">
            <p>.xlsx maksimal 2 MB · {IMPORT_MAX_ROWS[domain]} {domain === "purchases" ? "pembelian" : "baris data"} per file.</p>
            {domain === "products" && <><p>Isi sheet Produk dan Komposisi. Kode bahan harus sudah ada di outlet; bahan baru diimpor lebih dahulu.</p><p>Harga kosong mempertahankan harga tersimpan atau memakai harga dasar. Gambar harus merujuk nama file di ZIP terpisah; gambar kosong mempertahankan gambar lama.</p><p>ZIP maksimal 3 MB; total Excel + ZIP maksimal 4 MB. Gambar JPG, PNG, atau WebP.</p></>}
            {domain === "ingredients" && <p>Satuan: gram, ml, pcs, kg, atau liter. Stok awal berlaku untuk bahan baru; pembaruan tidak mengubah stok aktual.</p>}
            {domain === "employees" && <p>Nama peran dan outlet harus cocok dengan data yang tersedia. PIN tidak ditampilkan di pratinjau atau riwayat.</p>}
            {domain === "purchases" && <p>Tanggal YYYY-MM-DD; satuan harus cocok dengan bahan. Referensi identik dilewati agar stok tidak bertambah dua kali.</p>}
          </div></details>
        </fieldset>
      </OwnerSection>}

      {(phase === "preview" || phase === "confirm") && validation && <div className="min-w-0 space-y-5" aria-busy={!!pending}>
        <OwnerSection title="Pratinjau impor">
          <p className="mb-3 break-words text-sm font-medium [overflow-wrap:anywhere]">{excel?.name}{imagesZip ? ` · ${imagesZip.name}` : ""}</p>
          <dl className="flex flex-wrap gap-2">{previewMetrics.map(([label, count]) => <div key={label} className="rounded-lg bg-surface-container-low px-3 py-2"><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="font-semibold tabular-nums">{count}</dd></div>)}</dl>
          <div className="mt-3 space-y-2 text-sm text-on-surface-variant">
            {summary?.limit_note && <p>{summary.limit_note}</p>}
            {validation.sheet_max_note && <p>{validation.sheet_max_note}</p>}
            {domain === "purchases" && (summary?.purchase_replays ?? 0) > 0 && <p>{summary?.purchase_replays} referensi pembelian sudah pernah dicatat dan akan dilewati.</p>}
          </div>
          {serverBlocked && <p role="alert" className="mt-3 rounded-lg bg-error/5 p-3 text-sm text-error">Ada kesalahan. Perbaiki baris bermasalah, lalu validasi ulang. Belum ada data yang disimpan.</p>}
          {expired && <OwnerError message={recoveryMessage("IMPORT_EXPIRED")!} />}
          <div className="mt-3 space-y-3"><ImportIssues issues={structural} /><ImportIssues issues={validation.warnings ?? []} warning />
            {hasIssues && <button type="button" className={SECONDARY} onClick={() => downloadImportErrors(rows, [...structural, ...(validation.warnings ?? []).map(issue => ({ ...issue, message: `Peringatan: ${issue.message}` }))])}><Download size={16} aria-hidden="true" />Unduh kesalahan & peringatan CSV</button>}
          </div>
        </OwnerSection>

        <OwnerSection title={domain === "products" ? "Produk & komposisi" : domain === "purchases" ? "Pembelian & item" : DOMAIN_LABEL[domain]}>
          <ImportRowsPreview rows={rows} domain={domain} conflictMode={conflictMode} />
        </OwnerSection>

        {domain !== "purchases" && conflicts > 0 && <fieldset disabled={!!pending} className="space-y-2 rounded-xl border border-surface-container p-4">
          <legend className="px-1 text-sm font-semibold">Kode yang sudah ada · {conflicts}</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="radio" name={`${id}-conflict`} checked={conflictMode === "skip"} onChange={() => changeMode("skip")} className="h-5 w-5 shrink-0" /><span><strong>Lewati</strong> data lama tetap.</span></label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="radio" name={`${id}-conflict`} checked={conflictMode === "update"} onChange={() => changeMode("update")} className="h-5 w-5 shrink-0" /><span><strong>Perbarui</strong> pakai data dari file.</span></label>
        </fieldset>}
        {domain === "purchases" && <p className="rounded-xl bg-surface-container-low p-4 text-sm">Pembelian yang sama tidak ditambahkan dua kali.</p>}
        {newCategories.length > 0 && <fieldset disabled={!!pending} className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <legend className="px-1 text-sm font-semibold">Kategori baru</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={allowNewCategories} onChange={event => changeConsent(event.target.checked)} className="h-5 w-5 shrink-0" /><span>Buat: <strong>{newCategories.join(", ")}</strong></span></label>
        </fieldset>}

        <div className="flex flex-wrap gap-2">
          {phase === "preview" ? <button type="button" className={PRIMARY} disabled={!canConfirm || !!pending} onClick={() => setPhase("confirm")}>Lanjut ke konfirmasi</button> : <>
            <button type="button" className={PRIMARY} disabled={!canConfirm || !!pending} onClick={() => void confirm()}><CheckCircle2 size={16} aria-hidden="true" />{pending === "confirm" ? "Memproses…" : isDemo ? "Konfirmasi simulasi" : "Konfirmasi & simpan"}</button>
            <button type="button" className={SECONDARY} disabled={!!pending} onClick={() => setPhase("preview")}>Kembali ke pratinjau</button>
          </>}
          <button type="button" className={SECONDARY} disabled={!!pending || !excel || !hasOutlet} onClick={() => void validate()}><RefreshCw size={16} aria-hidden="true" />Validasi ulang</button>
          <button type="button" className={SECONDARY} disabled={!!pending} onClick={editFiles}>Pilih / perbaiki file</button>
        </div>
        {!hasWork && !serverBlocked && <p role="status" className="text-sm text-on-surface-variant">Tidak ada perubahan. Pilih Perbarui untuk mengubah data yang sudah ada.</p>}
      </div>}

      {phase === "result" && result && <OwnerSection title={isDemo ? "Simulasi selesai" : "Konfirmasi selesai"} description="Hasil tetap tampil sampai Anda menutup panel ini.">
        <div className="space-y-4"><p role="status" className="flex items-center gap-2 text-sm font-semibold text-primary"><CheckCircle2 size={22} aria-hidden="true" />{result.imported ?? 0} data diimpor{isDemo ? " (simulasi)" : ""}.</p>
          <ImportResultSummary result={result} />
          <button type="button" className={PRIMARY} onClick={close}>Selesai & tutup</button>
        </div>
      </OwnerSection>}

      <ImportHistory key={historyRevision} domain={domain} outletId={outletId} />
    </div>
  </section>;
}
