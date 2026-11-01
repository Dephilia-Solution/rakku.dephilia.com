"use client";

import { useCallback, useEffect, useState } from "react";
import { showToast } from "@rakku/ui";
import { Check, Plus, Scale, X } from "lucide-react";

interface SettlementReport {
  id: string;
  provider: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  mdr_amount: number;
  net_amount: number;
  expected_net: number;
  difference: number;
  status: string;
  provider_reference: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

interface Summary {
  systemBalance: number;
  totalUnsettled: number;
  totalCreditedNet: number;
  totalMdr: number;
  totalWithdrawn: number;
  settlementNetTotal: number;
  cashPosition: number;
  gap: number;
}

function formatRupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

export default function ReconciliationPage() {
  const [paymentExceptions, setPaymentExceptions] = useState<Array<{
    intent_id: string; order_id: string; amount: number; reason: string;
    status?: string; assigned_to?: string | null; resolution_reference?: string | null;
  }>>([]);
  const [uncertainAttempts, setUncertainAttempts] = useState<Array<{ id: string; order_id: string; invoice_number: string; amount: number }>>([]);
  const [reports, setReports] = useState<SettlementReport[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [mdrAmount, setMdrAmount] = useState("");
  const [note, setNote] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/superadmin/reconciliation");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat data");
      setPaymentExceptions(data.paymentExceptions ?? []);
      setUncertainAttempts(data.uncertainAttempts ?? []);
      setReports(Array.isArray(data.reports) ? data.reports : []);
      setSummary(data.summary ?? null);
    } catch {
      showToast("error", "Gagal memuat data rekonsiliasi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleException = async (intentId: string, action: "investigate" | "resolve") => {
    const note = action === "resolve"
      ? window.prompt("Catatan resolusi (wajib):")
      : window.prompt("Catatan investigasi (opsional):") ?? "";
    if (action === "resolve" && !note?.trim()) return;
    const reference = action === "resolve" ? window.prompt("Referensi bukti/provider (opsional):") : null;
    try {
      const res = await fetch(`/api/superadmin/reconciliation/exceptions/${intentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note, resolution_type: "manual_review", reference }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error || "Gagal memperbarui exception");
        return;
      }
      showToast("success", action === "resolve" ? "Exception ditandai selesai" : "Exception masuk investigasi");
      fetchData();
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
    }
  };

  const handleSubmit = async () => {
    const gross = Number(grossAmount);
    const mdr = Number(mdrAmount) || 0;

    if (!periodStart || !periodEnd) {
      showToast("error", "Periode settlement wajib diisi");
      return;
    }
    if (!Number.isFinite(gross) || gross < 0) {
      showToast("error", "Nominal gross tidak valid");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/superadmin/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "vessel",
          period_start: periodStart,
          period_end: periodEnd,
          gross_amount: gross,
          mdr_amount: mdr,
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error || "Gagal menyimpan rekonsiliasi");
        return;
      }
      showToast(
        data.settlement?.settled ? "success" : "info",
        data.settlement?.settled
          ? "Settlement cocok; saldo belum settlement dilepas."
          : "Settlement dicatat sebagai discrepancy; saldo belum dilepas.",
      );
      setShowForm(false);
      setPeriodStart("");
      setPeriodEnd("");
      setGrossAmount("");
      setMdrAmount("");
      setNote("");
      fetchData();
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
    } finally {
      setSaving(false);
    }
  };

  const gap = summary?.gap ?? 0;
  const netPreview =
    Number(grossAmount || 0) - (Number(mdrAmount) || 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-neutral-900">
            Reconciliation
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Bandingkan settlement Vessel/DOKU dengan saldo sistem.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-forest text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark flex items-center gap-2"
        >
          <Plus size={16} />
          Catat Settlement
        </button>
      </div>

      {(paymentExceptions.length > 0 || uncertainAttempts.length > 0) && <section role="alert" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
        <h2 className="font-semibold">Pembayaran perlu diperiksa</h2>
        <p className="mt-1">Konfirmasikan status ke provider sebelum refund atau pencairan. Pembayaran berikut belum dibukukan sebagai penjualan tambahan.</p>
        {paymentExceptions.map(item => (
          <div key={item.intent_id} className="mt-2 break-all">
            <p>Order {item.order_id} · {formatRupiah(item.amount)} · {item.reason} · {item.status ?? "open"}</p>
            {item.resolution_reference && <p className="text-xs">Referensi: {item.resolution_reference}</p>}
            <div className="flex flex-wrap gap-2 mt-1">
              <button type="button" onClick={() => void handleException(item.intent_id, "investigate")}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs">Investigasi</button>
              <button type="button" onClick={() => void handleException(item.intent_id, "resolve")}
                className="rounded-lg bg-forest px-2 py-1 text-xs text-white">Tandai selesai</button>
            </div>
          </div>
        ))}
        {uncertainAttempts.map(item => <p key={item.id} className="mt-2 break-all">Invoice {item.invoice_number} · {formatRupiah(item.amount)} · Pembuatan belum terkonfirmasi</p>)}
      </section>}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Saldo sistem (kewajiban)
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {formatRupiah(summary?.systemBalance ?? 0)}
          </p>
          <p className="text-[11px] text-neutral-400 mt-1">
            Tersedia + hold + unsettled
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Belum settlement
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {formatRupiah(summary?.totalUnsettled ?? 0)}
          </p>
          <p className="text-[11px] text-neutral-400 mt-1">
            Belum boleh dicairkan
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Posisi kas (rekening)
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {formatRupiah(summary?.cashPosition ?? 0)}
          </p>
          <p className="text-[11px] text-neutral-400 mt-1">
            Settlement − pencairan selesai
          </p>
        </div>
        <div
          className={`rounded-2xl shadow-sm p-4 ${
            gap < 0 ? "bg-red-50" : "bg-white"
          }`}
        >
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Selisih (gap)
          </p>
          <p
            className={`text-xl font-bold mt-1 ${
              gap < 0 ? "text-danger" : "text-forest"
            }`}
          >
            {formatRupiah(gap)}
          </p>
          <p className="text-[11px] text-neutral-400 mt-1">
            {gap < 0 ? "Kas kurang dari kewajiban" : "Kas cukup"}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Total MDR (0,7%)
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {formatRupiah(summary?.totalMdr ?? 0)}
          </p>
          <p className="text-[11px] text-neutral-400 mt-1">
            Kredit net {formatRupiah(summary?.totalCreditedNet ?? 0)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Periode</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Provider</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Gross</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">MDR</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Net</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Expected</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Selisih</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-neutral-400">
                    Memuat data...
                  </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-neutral-400">
                    <Scale size={22} className="mx-auto mb-2 text-neutral-300" />
                  Belum ada catatan settlement.
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm text-neutral-900 whitespace-nowrap">
                    {new Date(report.period_start).toLocaleDateString("id-ID")} —{" "}
                    {new Date(report.period_end).toLocaleDateString("id-ID")}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600 capitalize">
                    {report.provider}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    <span className={`rounded-full px-2 py-1 ${
                      report.status === "matched" ? "bg-primary-100 text-forest" : "bg-amber-100 text-amber-700"
                    }`}>{report.status}</span>
                    {report.provider_reference && <div className="font-mono mt-1 text-[10px]">{report.provider_reference}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono">
                    {formatRupiah(report.gross_amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-500">
                    {formatRupiah(report.mdr_amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono">
                    {formatRupiah(report.net_amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-500">
                    {formatRupiah(report.expected_net)}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm text-right font-mono font-semibold ${
                      Number(report.difference) === 0
                        ? "text-forest"
                        : "text-danger"
                    }`}
                  >
                    {formatRupiah(report.difference)}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500 max-w-[200px] truncate">
                    {report.note ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-base">
                Catat Settlement
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                    Periode Mulai
                  </label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                    Periode Akhir
                  </label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Gross Settlement (Rp)
                </label>
                <input
                  type="number"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-right font-mono focus:outline-none focus:border-forest"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  MDR (Rp)
                </label>
                <input
                  type="number"
                  value={mdrAmount}
                  onChange={(e) => setMdrAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-right font-mono focus:outline-none focus:border-forest"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  Net otomatis: {formatRupiah(netPreview)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Catatan (opsional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="mis. batch settlement 1–7 Sep"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl py-2.5 hover:bg-neutral-200"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex-1 bg-forest text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-forest-dark disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
