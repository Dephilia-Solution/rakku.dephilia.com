"use client";

import { useEffect, useRef, useState } from "react";
import ImportHistory from "./ImportHistory";
import { useMerchantRequest, useMerchantRuntime } from "@/lib/merchant-runtime";
import { usePlan } from "@/components/billing/PlanProvider";
import {
  IMPORT_MAX_ROWS,
  type ImportDomain,
} from "@/lib/import/import-spec";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, RefreshCw, Upload, X } from "lucide-react";

interface ValidateRow {
  row_number: number;
  sheet_name?: string;
  sheet_row?: number;
  kind?: string;
  ingredient_mode?: string;
  name: string;
  errors: { field: string | null; message: string }[];
}

interface ValidateResponse {
  error?: string;
  batch_id: string;
  summary?: {
    total: number;
    valid: number;
    errors: number;
    max_rows: number;
    limit_used: string | null;
    limit_note: string | null;
    linked_errors?: number;
    can_confirm?: boolean;
    new_ingredients?: number;
    existing_ingredients?: number;
    recipes?: number;
  };
  rows?: ValidateRow[];
  sheet_max_note?: string | null;
}

interface Props {
  domain: ImportDomain;
  outletId?: string;
  outletName?: string;
  onClose: () => void;
  onImported?: () => void;
}

const DOMAIN_LABEL: Record<ImportDomain, string> = {
  products: "Produk",
  employees: "Karyawan",
  ingredients: "Bahan Baku",
};

type Phase = "idle" | "validating" | "result" | "importing" | "done";

export default function ImportExcelPanel({
  domain,
  outletId,
  outletName,
  onClose,
  onImported,
}: Props) {
  const request = useMerchantRequest();
  const isDemo = !!useMerchantRuntime();
  const { openUpgrade } = usePlan();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const active = new AbortController();
    controller.current = active;
    return () => active.abort();
  }, []);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneInfo, setDoneInfo] = useState<{
    imported: number;
    failed: number;
    message: string | null;
  } | null>(null);
  const maxRows = IMPORT_MAX_ROWS[domain];

  const handleValidate = async (file: File) => {
    if (isDemo) { setError("Import Excel belum tersedia dalam mode demo."); return; }
    if (domain !== "employees" && !outletId) { setError("Pilih outlet tujuan sebelum mengimpor."); return; }
    setFileName(file.name);
    setError(null);
    setPlanLimitMessage(null);
    setPhase("validating");
    try {
      const form = new FormData();
      form.append("domain", domain);
      if (domain !== "employees" && outletId) form.append("outlet_id", outletId);
      form.append("file", file);
      const res = await request("/api/owner/import/validate", {
        method: "POST",
        body: form,
        signal: controller.current?.signal,
      });
      const data = (await res.json()) as ValidateResponse & { code?: string };
      if (controller.current?.signal.aborted) return;
      if (res.status === 403 && data.code === "PLAN_LIMIT") {
        setPhase("idle");
        setPlanLimitMessage(
          data.error ?? "Kuota paket Anda sudah habis untuk item ini."
        );
        return;
      }
      if (!res.ok) {
        setPhase("idle");
        setError(data.error ?? "Gagal memvalidasi file");
        return;
      }
      setResult(data);
      setPhase("result");
    } catch {
      if (controller.current?.signal.aborted) return;
      setPhase("idle");
      setError(
        isDemo
          ? "Import Excel belum tersedia dalam mode demo."
          : "Gagal memvalidasi file"
      );
    }
  };

  const handleConfirm = async () => {
    if (!result?.batch_id || result.summary?.can_confirm === false || (result.summary?.linked_errors ?? 0) > 0) return;
    setPhase("importing");
    setError(null);
    try {
      const res = await request("/api/owner/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: result.batch_id }),
        signal: controller.current?.signal,
      });
      const data = await res.json();
      if (controller.current?.signal.aborted) return;
      if (!res.ok) {
        if (data.code === "PLAN_LIMIT") setPlanLimitMessage(data.error);
        setPhase("result");
        setError(data.error ?? "Gagal mengimpor data");
        return;
      }
      setDoneInfo({
        imported: Number(data.imported) || 0,
        failed: Number(data.failed) || 0,
        message: res.ok ? null : (data.error ?? null),
      });
      setPhase("done");
    } catch {
      if (controller.current?.signal.aborted) return;
      setPhase("result");
      setError("Gagal mengimpor data");
    }
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setFileName("");
    setError(null);
    setPlanLimitMessage(null);
    setDoneInfo(null);
  };

  const validCount = result?.summary?.valid ?? 0;
  const errorCount = result?.summary?.errors ?? 0;

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 bg-surface-container-low border-b border-surface-container">
        <div>
          <h3 className="text-sm font-bold text-on-surface">
            {phase === "done" ? "Impor selesai" : `Import Excel — ${DOMAIN_LABEL[domain]}`}
          </h3>
          {domain !== "employees" && outletName && (
            <p className="text-xs text-on-surface-variant mt-0.5">
              Tujuan: {outletName}
            </p>
          )}
        </div>
        <button
          onClick={() => { if (phase === "done" && onImported) onImported(); else onClose(); }}
          disabled={phase === "validating" || phase === "importing"}
          className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Tutup"
        >
          <X size={17} />
        </button>
      </div>

      <div className="p-4 md:p-5 space-y-4">
        {isDemo && <p className="text-sm text-on-surface-variant">Impor file tersedia di akun bisnis. Mode demo menampilkan alur pengelolaan outlet tanpa menyimpan file.</p>}
        {/* Step indicator */}
        {phase !== "done" && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`font-semibold ${
                phase === "idle" || phase === "validating"
                  ? "text-primary"
                  : "text-on-surface-variant"
              }`}
            >
              1. Unggah file
            </span>
            <span className="flex-1 h-px bg-surface-container-high" />
            <span
              className={`font-semibold ${
                phase === "result" || phase === "importing"
                  ? "text-primary"
                  : "text-on-surface-variant"
              }`}
            >
              2. Cek hasil
            </span>
            <span className="flex-1 h-px bg-surface-container-high" />
            <span className="font-semibold text-on-surface-variant">3. Impor</span>
          </div>
        )}

        {/* Plan limit banner */}
        {planLimitMessage && (
          <div className="bg-error/5 border border-error/20 rounded-xl p-3.5 flex items-start gap-3">
            <AlertTriangle size={18} className="text-error flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-error">{planLimitMessage}</p>
              <button
                onClick={() => openUpgrade("Kuota paket Anda tercapai. Upgrade untuk impor lebih banyak data.")}
                className="text-xs font-semibold text-primary underline underline-offset-2 mt-1"
              >
                Lihat paket upgrade
              </button>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-error/5 border border-error/20 rounded-xl p-3.5 flex items-start gap-3">
            <AlertTriangle size={18} className="text-error flex-shrink-0 mt-0.5" />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* Idle: instructions + upload */}
        {phase === "idle" && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={isDemo ? undefined : `/api/owner/import/template?domain=${domain}${domain !== "employees" ? `&outlet_id=${encodeURIComponent(outletId ?? "")}` : ""}`}
                download={isDemo ? undefined : true}
                onClick={
                  isDemo
                    ? (e) => {
                        e.preventDefault();
                        setError("Template hanya dapat diunduh di aplikasi utama.");
                      }
                    : undefined
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/5 border border-primary/20 text-primary text-sm font-semibold rounded-xl hover:bg-primary/10 transition-all"
              >
                <Download size={15} />
                Unduh Template
              </a>
              <span className="text-xs text-on-surface-variant">Maksimal {maxRows} baris data utama · 2 MB (XLSX/XLS)</span>
            </div>
            {domain !== "employees" && <p className="text-xs text-on-surface-variant leading-relaxed">
              {domain === "products" ? "Resep opsional: hubungkan kode_produk dan kode_bahan pada sheet Komposisi (maksimal 2000 baris). " : "Isi bahan baru pada sheet BahanBaku. "}
              Bahan lama direferensikan dengan id_bahan atau nama+satuan unik di outlet tujuan. Kosongkan/isi 0 pada stok dan biaya bahan lama; data lama tidak diubah. Tidak ada konversi satuan otomatis. Perbaiki semua kesalahan workbook terkait sebelum konfirmasi.
            </p>}

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isDemo || phase !== "idle" || (domain !== "employees" && !outletId)}
              className="w-full border-2 border-dashed border-surface-container-high rounded-2xl p-8 flex flex-col items-center gap-2.5 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-60"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <Upload size={22} />
              </div>
              <p className="text-sm font-semibold text-on-surface">
                Pilih file Excel
              </p>
              <p className="text-xs text-on-surface-variant">
                {fileName ? fileName : "Klik untuk memilih file dari perangkat Anda"}
              </p>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleValidate(file);
                e.target.value = "";
              }}
            />
          </>
        )}

        {/* Validating */}
        {phase === "validating" && (
          <div className="py-10 flex flex-col items-center gap-3 text-on-surface-variant">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm font-medium">Memvalidasi {fileName}…</p>
          </div>
        )}

        {/* Result preview */}
        {phase === "result" && result && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-container-low rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-on-surface">
                  {result.summary?.total ?? 0}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  Baris data
                </p>
              </div>
              <div className="bg-success/10 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-success">{validCount}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  {DOMAIN_LABEL[domain]} siap
                </p>
              </div>
              <div className="bg-error/10 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-error">{errorCount}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  Bermasalah
                </p>
              </div>
            </div>

            {domain !== "employees" && <p className="text-xs text-on-surface-variant">
              {result.summary?.new_ingredients ?? 0} bahan baru · {result.summary?.existing_ingredients ?? 0} referensi bahan lama · {result.summary?.recipes ?? 0} baris komposisi
            </p>}
            {(result.summary?.linked_errors ?? 0) > 0 && <p role="alert" className="text-xs text-error">
              Konfirmasi diblokir: perbaiki seluruh kesalahan pada sheet terkait lalu unggah ulang. Produk, bahan baru, dan komposisi disimpan bersama dalam satu transaksi.
            </p>}

            {result.summary?.limit_used && (
              <p className="text-xs text-on-surface-variant">
                Kuota saat ini: {result.summary.limit_used} {DOMAIN_LABEL[domain].toLowerCase()}
              </p>
            )}
            {result.sheet_max_note && (
              <p className="text-xs text-error">{result.sheet_max_note}</p>
            )}

            <div className="max-h-64 overflow-y-auto rounded-xl border border-surface-container divide-y divide-surface-container">
              {(result.rows ?? []).map((row) => (
                <div key={row.row_number} className="flex flex-wrap items-start gap-2.5 px-3.5 py-2.5">
                  <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container-low rounded px-1.5 py-0.5 mt-0.5 max-w-full break-words">
                    {row.sheet_name ? `${row.sheet_name} #${row.sheet_row ?? row.row_number}` : `#${row.row_number}`}
                  </span>
                    <span className="text-xs font-medium text-on-surface min-w-0 flex-1 break-words">
                    {row.name}
                  </span>
                  {row.errors.length === 0 ? (
                    <span className="text-xs text-success flex items-center gap-1 min-w-0 w-full sm:w-auto">
                      <CheckCircle2 size={12} className="flex-shrink-0" />
                      {row.ingredient_mode === "existing" ? "Referensi saja (stok/biaya tetap)" : "Siap diimpor"}
                    </span>
                  ) : (
                    <span className="text-xs text-error min-w-0 w-full break-words">
                      {row.errors.map((err) => err.message).join(" · ")}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                onClick={handleConfirm}
                disabled={validCount === 0 || result.summary?.can_confirm === false || (result.summary?.linked_errors ?? 0) > 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary text-sm font-semibold rounded-xl shadow-md shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet size={15} />
                Impor {validCount} data
              </button>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-container text-on-surface-variant text-sm font-semibold rounded-xl hover:bg-surface-container-high transition-all"
              >
                <RefreshCw size={14} />
                Unggah ulang
              </button>
            </div>
          </>
        )}

        {!isDemo && phase !== "validating" && phase !== "importing" && <ImportHistory key={phase === "done" ? "updated" : "history"} domain={domain} outletId={outletId} />}

        {/* Importing */}
        {phase === "importing" && (
          <div className="py-10 flex flex-col items-center gap-3 text-on-surface-variant">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm font-medium">Menulis {validCount} data…</p>
          </div>
        )}

        {/* Done */}
        {phase === "done" && doneInfo && (
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-2">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  doneInfo.failed === 0 && !doneInfo.message
                    ? "bg-success/10 text-success"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <CheckCircle2 size={28} />
              </div>
              <p className="text-base font-bold text-on-surface">
                {doneInfo.imported} data berhasil diimpor
              </p>
              {doneInfo.failed > 0 && (
                <p className="text-sm text-on-surface-variant">
                  {doneInfo.failed} baris gagal diproses.
                </p>
              )}
              {doneInfo.message && (
                <p className="text-xs text-error max-w-sm">{doneInfo.message}</p>
              )}
            </div>
            <div className="flex justify-center gap-2.5">
              <button
                onClick={() => {
                  if (onImported) onImported();
                  else onClose();
                }}
                className="px-6 py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all"
              >
                Selesai
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
