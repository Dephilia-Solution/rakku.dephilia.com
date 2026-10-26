"use client";

import { useState } from "react";
import { useMerchantRequest } from "@/lib/merchant-runtime";
import type { ImportDomain } from "@/lib/import/import-spec";

interface Batch {
  id: string; domain: string; outlet_id: string | null; file_name: string;
  imported_rows: number; error_rows: number; status: string; created_at: string;
}

export default function ImportHistory({ domain, outletId }: { domain: ImportDomain; outletId?: string }) {
  const request = useMerchantRequest();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await request(`/api/owner/import/batches?domain=${domain}${domain !== "employees" && outletId ? `&outlet_id=${encodeURIComponent(outletId)}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat riwayat");
      setBatches((data.batches as Batch[]).filter(batch => batch.domain === domain && (!outletId || batch.outlet_id === outletId)));
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat riwayat"); }
    finally { setLoading(false); }
  };
  const downloadErrors = async (id: string) => {
    setError("");
    try {
      const res = await request(`/api/owner/import/batches?batch_id=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengunduh laporan");
      const escape = (value: unknown) => {
        let text = String(value ?? "");
        if (/^\s*[=+@\-]|^[\t\r]/.test(text)) text = `'${text}`;
        return `"${text.replaceAll('"', '""')}"`;
      };
      const rows = data.rows as { row_number: number; payload: { name?: string; sheet_name?: string; sheet_row?: number; kind?: string; product_code?: string; ingredient_code?: string; ingredient_id?: string }; errors: { message: string }[] }[];
      const csv = [["Sheet", "Baris", "Nama / Referensi", "Kesalahan"], ...rows.filter(row => row.errors.length).map(row =>
        [row.payload.sheet_name ?? "Data", row.payload.sheet_row ?? row.row_number,
          row.payload.name ?? `${row.payload.product_code ?? ""} → ${row.payload.ingredient_code || row.payload.ingredient_id || ""}`,
          row.errors.map(error => error.message).join("; ")])];
      const url = URL.createObjectURL(new Blob(["\uFEFF", csv.map(row => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = "laporan-kesalahan-impor.csv"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal mengunduh laporan"); }
  };
  return (
    <details className="border-t border-surface-container pt-4" onToggle={event => { if (event.currentTarget.open) void load(); }}>
      <summary className="cursor-pointer text-sm font-semibold text-on-surface">Riwayat impor {domain === "ingredients" ? "bahan baku" : domain === "products" ? "produk" : "karyawan"}</summary>
      {error && <p role="alert" className="text-xs text-error mt-3">{error}</p>}
      {loading ? <p className="text-xs text-on-surface-variant mt-3">Memuat riwayat…</p> : (
        <div className="mt-3 divide-y divide-surface-container">
          {batches.length === 0 && <p className="text-xs text-on-surface-variant">Belum ada riwayat impor.</p>}
          {batches.map(batch => <div key={batch.id} className="py-3 text-xs space-y-1">
            <p className="font-semibold text-on-surface break-all">{batch.file_name}</p>
            <p className="text-on-surface-variant">
              {new Date(batch.created_at).toLocaleString("id-ID")} · {batch.status === "confirmed" ? `${batch.imported_rows} diimpor` : batch.status === "validated" ? "Sudah divalidasi" : "Gagal"}
            </p>
            {batch.error_rows > 0 && <button className="text-primary font-semibold underline underline-offset-2 min-h-9" onClick={() => void downloadErrors(batch.id)}>
              Unduh {batch.error_rows} baris bermasalah
            </button>}
          </div>)}
        </div>
      )}
    </details>
  );
}
