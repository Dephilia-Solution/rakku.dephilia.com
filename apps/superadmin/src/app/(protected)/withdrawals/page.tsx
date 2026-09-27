"use client";

import { useCallback, useEffect, useState } from "react";
import { showToast } from "@rakku/ui";
import { ArrowDownToLine, Check, X, Search } from "lucide-react";

interface WithdrawalRow {
  id: string;
  amount: number;
  fee: number;
  net_amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: string;
  note: string | null;
  reject_reason: string | null;
  reference_number: string | null;
  transfer_proof_url: string | null;
  requested_at: string;
  processed_at: string | null;
  processed_by: string | null;
  companies?: { name: string; code: string } | { name: string; code: string }[] | null;
}

interface Summary {
  pendingCount: number;
  pendingTotal: number;
  completedThisMonth: number;
}

const STATUS_LABEL: Record<string, string> = {
  requested: "Menunggu",
  processing: "Diproses",
  completed: "Selesai",
  rejected: "Ditolak",
  failed: "Gagal",
};

function embedded<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatRupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [completeTarget, setCompleteTarget] = useState<WithdrawalRow | null>(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  const [rejectTarget, setRejectTarget] = useState<WithdrawalRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const url = statusFilter
        ? `/api/superadmin/withdrawals?status=${statusFilter}`
        : "/api/superadmin/withdrawals";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat data");
      setWithdrawals(Array.isArray(data.withdrawals) ? data.withdrawals : []);
      setSummary(data.summary ?? null);
    } catch {
      showToast("error", "Gagal memuat data pencairan");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const callAction = async (
    id: string,
    action: "process" | "complete" | "reject",
    body?: Record<string, unknown>
  ) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/withdrawals/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error || "Gagal memproses");
        return false;
      }
      showToast("success", "Status diperbarui");
      fetchData();
      return true;
    } catch {
      showToast("error", "Terjadi kesalahan");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!completeTarget) return;
    if (!referenceNumber.trim()) {
      showToast("error", "Nomor referensi transfer wajib diisi");
      return;
    }
    const ok = await callAction(completeTarget.id, "complete", {
      reference_number: referenceNumber.trim(),
      transfer_proof_url: proofUrl.trim() || null,
    });
    if (ok) {
      setCompleteTarget(null);
      setReferenceNumber("");
      setProofUrl("");
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      showToast("error", "Alasan penolakan wajib diisi");
      return;
    }
    const ok = await callAction(rejectTarget.id, "reject", {
      reason: rejectReason.trim(),
    });
    if (ok) {
      setRejectTarget(null);
      setRejectReason("");
    }
  };

  const filtered = withdrawals.filter((row) => {
    if (!search) return true;
    const company = embedded(row.companies);
    const query = search.toLowerCase();
    return (
      (company?.name ?? "").toLowerCase().includes(query) ||
      (company?.code ?? "").toLowerCase().includes(query) ||
      row.account_holder.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-neutral-900">
          Withdrawals
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Antrian pencairan saldo merchant — proses transfer manual.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Menunggu diproses
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {summary?.pendingCount ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Total menunggu
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {formatRupiah(summary?.pendingTotal ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Selesai bulan ini
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {formatRupiah(summary?.completedThisMonth ?? 0)}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative max-w-xs w-full">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="text"
            placeholder="Cari company / pemilik..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-forest"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
        >
          <option value="">Semua status</option>
          <option value="requested">Menunggu</option>
          <option value="processing">Diproses</option>
          <option value="completed">Selesai</option>
          <option value="rejected">Ditolak</option>
          <option value="failed">Gagal</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Company</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Rekening</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Nominal</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Diajukan</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-400">
                  Memuat data...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-400">
                  <ArrowDownToLine size={22} className="mx-auto mb-2 text-neutral-300" />
                  Belum ada pengajuan pencairan.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const company = embedded(row.companies);
                const active = ["requested", "processing"].includes(row.status);
                return (
                  <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      {company?.name ?? "-"}
                      <span className="ml-2 font-mono text-[11px] text-neutral-400">
                        {company?.code ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {row.bank_name} · {row.account_number}
                      <p className="text-[11px] text-neutral-400">{row.account_holder}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {formatRupiah(row.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          row.status === "completed"
                            ? "bg-primary-100 text-forest"
                            : row.status === "rejected" || row.status === "failed"
                              ? "bg-red-50 text-danger"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                      {new Date(row.requested_at).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      {active ? (
                        <div className="flex flex-wrap gap-1.5">
                          {row.status === "requested" && (
                            <button
                              onClick={() => callAction(row.id, "process")}
                              disabled={saving}
                              className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg px-2.5 py-1.5"
                            >
                              Proses
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setCompleteTarget(row);
                              setReferenceNumber("");
                              setProofUrl("");
                            }}
                            className="text-xs font-semibold text-forest bg-primary-50 hover:bg-primary-100 rounded-lg px-2.5 py-1.5"
                          >
                            Selesaikan
                          </button>
                          <button
                            onClick={() => {
                              setRejectTarget(row);
                              setRejectReason("");
                            }}
                            className="text-xs font-semibold text-danger bg-red-50 hover:bg-red-100 rounded-lg px-2.5 py-1.5"
                          >
                            Tolak
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">
                          {row.reference_number ?? row.reject_reason ?? "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {completeTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-base">
                Selesaikan Pencairan
              </h3>
              <button
                onClick={() => setCompleteTarget(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-neutral-50 rounded-xl p-3 text-sm mb-4">
              <p className="text-neutral-500 text-xs">Tujuan transfer</p>
              <p className="font-semibold text-neutral-900 mt-0.5">
                {completeTarget.bank_name} · {completeTarget.account_number}
              </p>
              <p className="text-xs text-neutral-500">{completeTarget.account_holder}</p>
              <p className="font-mono font-semibold text-forest mt-2">
                {formatRupiah(completeTarget.amount)}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Nomor Referensi Transfer
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="mis. TRF-20260911-001"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  URL Bukti Transfer (opsional)
                </label>
                <input
                  type="text"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCompleteTarget(null)}
                  className="flex-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl py-2.5 hover:bg-neutral-200"
                >
                  Batal
                </button>
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="flex-1 bg-forest text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-forest-dark disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-base">
                Tolak Pencairan
              </h3>
              <button
                onClick={() => setRejectTarget(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-sm text-neutral-500 mb-4">
              Saldo {formatRupiah(rejectTarget.amount)} akan dikembalikan ke
              saldo tersedia merchant.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Alasan Penolakan
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="mis. nama rekening tidak sesuai"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setRejectTarget(null)}
                  className="flex-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl py-2.5 hover:bg-neutral-200"
                >
                  Batal
                </button>
                <button
                  onClick={handleReject}
                  disabled={saving}
                  className="flex-1 bg-danger text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Tolak
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
