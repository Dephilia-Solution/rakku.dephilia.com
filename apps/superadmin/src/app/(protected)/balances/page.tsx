"use client";

import { useEffect, useState } from "react";
import { showToast } from "@rakku/ui";
import { Landmark, Pencil, X, Check, ScrollText } from "lucide-react";

interface BalanceRow {
  company_id: string;
  name: string;
  code: string;
  available_balance: number;
  pending_balance: number;
  total_credited: number;
  total_fees: number;
  total_withdrawn: number;
}

interface Totals {
  available: number;
  pending: number;
  credited: number;
  fees: number;
  withdrawn: number;
}

interface LedgerRow {
  id: string;
  type: string;
  amount: number;
  fee_amount: number;
  balance_after: number;
  note: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  sale_credit: "Pembayaran QRIS",
  withdrawal_hold: "Hold pencairan",
  withdrawal: "Pencairan selesai",
  withdrawal_refund: "Pencairan ditolak",
  withdrawal_fee: "Biaya pencairan",
  adjustment: "Penyesuaian",
  refund: "Refund",
};

function formatRupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

export default function BalancesPage() {
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [adjustTarget, setAdjustTarget] = useState<BalanceRow | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [ledgerTarget, setLedgerTarget] = useState<BalanceRow | null>(null);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const fetchBalances = async () => {
    try {
      const res = await fetch("/api/superadmin/balances");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat saldo");
      setBalances(Array.isArray(data.balances) ? data.balances : []);
      setTotals(data.totals ?? null);
    } catch {
      showToast("error", "Gagal memuat data saldo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  const handleAdjust = async () => {
    if (!adjustTarget) return;
    const amount = Number(adjustAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      showToast("error", "Nominal harus angka dan tidak 0");
      return;
    }
    if (!adjustNote.trim()) {
      showToast("error", "Catatan wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/superadmin/balances/${adjustTarget.company_id}/adjust`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, note: adjustNote.trim() }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error || "Gagal menyesuaikan saldo");
        return;
      }
      showToast("success", "Saldo disesuaikan");
      setAdjustTarget(null);
      setAdjustAmount("");
      setAdjustNote("");
      fetchBalances();
    } catch {
      showToast("error", "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const openLedger = async (row: BalanceRow) => {
    setLedgerTarget(row);
    setLedgerLoading(true);
    try {
      const res = await fetch(
        `/api/superadmin/balances?company_id=${encodeURIComponent(row.company_id)}`
      );
      const data = await res.json();
      setLedgerRows(Array.isArray(data.transactions) ? data.transactions : []);
    } catch {
      setLedgerRows([]);
    } finally {
      setLedgerLoading(false);
    }
  };

  const filtered = balances.filter(
    (row) =>
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      row.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-neutral-900">
          Balances
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Saldo merchant dari pembayaran QRIS & pemantauan float.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Float (saldo tersedia)
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {formatRupiah(totals?.available ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Sedang diproses
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {formatRupiah(totals?.pending ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Total MDR terkumpul
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {formatRupiah(totals?.fees ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Total ditarik
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {formatRupiah(totals?.withdrawn ?? 0)}
          </p>
        </div>
      </div>

      <div className="relative max-w-xs mb-4">
        <input
          type="text"
          placeholder="Cari company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Company</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Tersedia</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Pending</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Total Masuk</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">MDR</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Ditarik</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-neutral-400">
                  Memuat data...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-neutral-400">
                  <Landmark size={22} className="mx-auto mb-2 text-neutral-300" />
                  Belum ada data saldo.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.company_id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm text-neutral-900">
                    {row.name}
                    <span className="ml-2 font-mono text-[11px] text-neutral-400">
                      {row.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono">
                    {formatRupiah(row.available_balance)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-500">
                    {formatRupiah(row.pending_balance)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-500">
                    {formatRupiah(row.total_credited)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-500">
                    {formatRupiah(row.total_fees)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-500">
                    {formatRupiah(row.total_withdrawn)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openLedger(row)}
                        title="Lihat ledger"
                        className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500"
                      >
                        <ScrollText size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setAdjustTarget(row);
                          setAdjustAmount("");
                          setAdjustNote("");
                        }}
                        title="Sesuaikan saldo"
                        className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {adjustTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-base">
                Sesuaikan Saldo — {adjustTarget.name}
              </h3>
              <button
                onClick={() => setAdjustTarget(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Nominal (boleh negatif)
                </label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="100000 atau -50000"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Catatan (wajib)
                </label>
                <textarea
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  rows={3}
                  placeholder="Alasan koreksi saldo..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setAdjustTarget(null)}
                  className="flex-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl py-2.5 hover:bg-neutral-200"
                >
                  Batal
                </button>
                <button
                  onClick={handleAdjust}
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

      {ledgerTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-base">
                Ledger — {ledgerTarget.name}
              </h3>
              <button
                onClick={() => setLedgerTarget(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400"
              >
                <X size={16} />
              </button>
            </div>

            {ledgerLoading ? (
              <p className="py-8 text-center text-sm text-neutral-400">
                Memuat ledger...
              </p>
            ) : ledgerRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-400">
                Belum ada transaksi.
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400 uppercase tracking-wider">
                    <th className="px-3 py-2">Waktu</th>
                    <th className="px-3 py-2">Jenis</th>
                    <th className="px-3 py-2">Catatan</th>
                    <th className="px-3 py-2 text-right">Nominal</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((tx) => (
                    <tr key={tx.id} className="border-b border-neutral-50 text-sm">
                      <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-3 py-2">
                        {TYPE_LABEL[tx.type] ?? tx.type}
                      </td>
                      <td className="px-3 py-2 text-neutral-500 text-xs max-w-[200px] truncate">
                        {tx.note ?? "-"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          tx.amount > 0
                            ? "text-forest"
                            : tx.amount < 0
                              ? "text-danger"
                              : "text-neutral-400"
                        }`}
                      >
                        {formatRupiah(tx.amount)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-neutral-600">
                        {formatRupiah(tx.balance_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
