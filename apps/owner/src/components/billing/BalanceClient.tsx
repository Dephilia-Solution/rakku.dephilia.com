"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@rakku/ui";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Landmark,
  Pencil,
  Plus,
  Star,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import type {
  BalanceTransaction,
  MerchantBalance,
  MerchantBankAccount,
  Withdrawal,
} from "@rakku/shared-types";
import { MIN_WITHDRAWAL, formatRupiah } from "@/lib/billing/withdrawals";

const TYPE_LABEL: Record<string, string> = {
  sale_credit: "Pembayaran QRIS",
  withdrawal_hold: "Hold pencairan",
  withdrawal: "Pencairan selesai",
  withdrawal_refund: "Pencairan ditolak",
  withdrawal_fee: "Biaya pencairan",
  adjustment: "Penyesuaian",
  refund: "Refund",
};

const WITHDRAWAL_STATUS_LABEL: Record<string, string> = {
  requested: "Menunggu",
  processing: "Diproses",
  completed: "Selesai",
  rejected: "Ditolak",
  failed: "Gagal",
};

function formatDateTime(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BalanceClient({
  balance,
  transactions,
  bankAccounts,
  withdrawals,
}: {
  balance: MerchantBalance;
  transactions: BalanceTransaction[];
  bankAccounts: MerchantBankAccount[];
  withdrawals: Withdrawal[];
}) {
  const router = useRouter();

  const defaultAccount =
    bankAccounts.find((a) => a.is_default && a.status === "active") ??
    bankAccounts.find((a) => a.status === "active") ??
    null;

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAccountId, setWithdrawAccountId] = useState(
    defaultAccount?.id ?? ""
  );
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<MerchantBankAccount | null>(null);
  const [accountBankName, setAccountBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountDefault, setAccountDefault] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  const cards = [
    { label: "Saldo tersedia", value: formatRupiah(balance.available_balance), accent: true },
    { label: "Sedang diproses", value: formatRupiah(balance.pending_balance) },
    { label: "Total masuk (gross)", value: formatRupiah(balance.total_credited) },
    { label: "Total MDR (0,7%)", value: formatRupiah(balance.total_fees) },
    { label: "Total ditarik", value: formatRupiah(balance.total_withdrawn) },
  ];

  const openWithdraw = () => {
    if (!defaultAccount) {
      showToast("error", "Tambahkan rekening bank terlebih dahulu");
      return;
    }
    setWithdrawAccountId(defaultAccount.id);
    setWithdrawAmount("");
    setWithdrawNote("");
    setShowWithdraw(true);
  };

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      showToast("error", `Minimal pencairan ${formatRupiah(MIN_WITHDRAWAL)}`);
      return;
    }
    if (!withdrawAccountId) {
      showToast("error", "Pilih rekening tujuan");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/owner/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_account_id: withdrawAccountId,
          amount,
          note: withdrawNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error || "Gagal mengajukan pencairan");
        return;
      }
      showToast("success", "Pengajuan pencairan dikirim");
      setShowWithdraw(false);
      router.refresh();
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
    } finally {
      setSubmitting(false);
    }
  };

  const openAccountForm = (account?: MerchantBankAccount) => {
    setEditingAccount(account ?? null);
    setAccountBankName(account?.bank_name ?? "");
    setAccountNumber(account?.account_number ?? "");
    setAccountHolder(account?.account_holder ?? "");
    setAccountDefault(account?.is_default ?? bankAccounts.length === 0);
    setShowAccountForm(true);
  };

  const handleSaveAccount = async () => {
    if (!accountBankName.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      showToast("error", "Lengkapi data rekening");
      return;
    }
    setSavingAccount(true);
    try {
      const payload = {
        bank_name: accountBankName.trim(),
        account_number: accountNumber.trim(),
        account_holder: accountHolder.trim(),
        is_default: accountDefault,
      };
      const res = editingAccount
        ? await fetch(`/api/owner/bank-accounts/${editingAccount.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/owner/bank-accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error || "Gagal menyimpan rekening");
        return;
      }
      showToast("success", editingAccount ? "Rekening diupdate" : "Rekening ditambahkan");
      setShowAccountForm(false);
      router.refresh();
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSetDefault = async (account: MerchantBankAccount) => {
    try {
      const res = await fetch(`/api/owner/bank-accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) {
        showToast("error", "Gagal menjadikan rekening utama");
        return;
      }
      router.refresh();
    } catch {
      showToast("error", "Terjadi kesalahan");
    }
  };

  const handleDeleteAccount = async (account: MerchantBankAccount) => {
    if (!confirm(`Hapus rekening ${account.bank_name} ${account.account_number}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/owner/bank-accounts/${account.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error || "Gagal menghapus rekening");
        return;
      }
      showToast("success", "Rekening dihapus");
      router.refresh();
    } catch {
      showToast("error", "Terjadi kesalahan");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Saldo</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Saldo dari pembayaran QRIS pelanggan. MDR 0,7% dipotong otomatis.
          </p>
        </div>
        <button
          onClick={openWithdraw}
          className="inline-flex items-center gap-2 rounded-xl bg-forest text-white px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark"
        >
          <Wallet size={16} />
          Tarik Dana
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-4 ${
              card.accent
                ? "bg-primary-50 border-primary-100"
                : "bg-white border-neutral-200"
            }`}
          >
            <p className="text-xs text-neutral-400 uppercase tracking-wider">
              {card.label}
            </p>
            <p className="text-lg font-bold text-neutral-900 mt-1">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-base text-neutral-900">
            Rekening Bank
          </h2>
          <button
            onClick={() => openAccountForm()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:bg-primary-50 rounded-lg px-3 py-2"
          >
            <Plus size={14} />
            Tambah Rekening
          </button>
        </div>

        {bankAccounts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-400">
            Belum ada rekening. Tambahkan rekening untuk mencairkan saldo.
          </p>
        ) : (
          <div className="divide-y divide-neutral-50">
            {bankAccounts.map((account) => (
              <div
                key={account.id}
                className="px-5 py-3.5 flex flex-wrap items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-500">
                  <Landmark size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                    {account.bank_name} · {account.account_number}
                    {account.is_default && (
                      <span className="text-[10px] font-semibold text-forest bg-primary-100 px-2 py-0.5 rounded-full">
                        Utama
                      </span>
                    )}
                    {account.status !== "active" && (
                      <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                        Nonaktif
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-400">{account.account_holder}</p>
                </div>
                <div className="flex items-center gap-1">
                  {!account.is_default && account.status === "active" && (
                    <button
                      onClick={() => handleSetDefault(account)}
                      title="Jadikan utama"
                      className="p-2 rounded-lg text-neutral-400 hover:text-forest hover:bg-primary-50"
                    >
                      <Star size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => openAccountForm(account)}
                    title="Edit"
                    className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(account)}
                    title="Hapus"
                    className="p-2 rounded-lg text-neutral-400 hover:text-danger hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="font-display font-semibold text-base text-neutral-900">
            Riwayat Pencairan
          </h2>
        </div>

        {withdrawals.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-400">
            Belum ada pengajuan pencairan.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Rekening</th>
                  <th className="px-5 py-3 text-right">Nominal</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id} className="border-b border-neutral-50 text-sm">
                    <td className="px-5 py-3 text-neutral-500 whitespace-nowrap">
                      {formatDateTime(withdrawal.requested_at)}
                    </td>
                    <td className="px-5 py-3 text-neutral-700">
                      {withdrawal.bank_name} · {withdrawal.account_number}
                    </td>
                    <td className="px-5 py-3 text-right font-mono">
                      {formatRupiah(withdrawal.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          withdrawal.status === "completed"
                            ? "bg-primary-100 text-forest"
                            : withdrawal.status === "rejected" ||
                                withdrawal.status === "failed"
                              ? "bg-red-50 text-danger"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {WITHDRAWAL_STATUS_LABEL[withdrawal.status] ?? withdrawal.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-neutral-500 text-xs max-w-[220px] truncate">
                      {withdrawal.status === "rejected" && withdrawal.reject_reason
                        ? withdrawal.reject_reason
                        : (withdrawal.note ?? "-")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="font-display font-semibold text-base text-neutral-900">
            Riwayat Saldo
          </h2>
        </div>

        {transactions.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-400">
            Belum ada transaksi saldo. Saldo akan bertambah setelah pembayaran
            QRIS dinamis berhasil.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Waktu</th>
                  <th className="px-5 py-3">Jenis</th>
                  <th className="px-5 py-3">Catatan</th>
                  <th className="px-5 py-3 text-right">Nominal</th>
                  <th className="px-5 py-3 text-right">Saldo Setelah</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const positive = tx.amount > 0;
                  return (
                    <tr key={tx.id} className="border-b border-neutral-50 text-sm">
                      <td className="px-5 py-3 text-neutral-500 whitespace-nowrap">
                        {formatDateTime(tx.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-neutral-800">
                          {positive ? (
                            <ArrowDownLeft size={14} className="text-forest" />
                          ) : tx.amount < 0 ? (
                            <ArrowUpRight size={14} className="text-danger" />
                          ) : (
                            <Wallet size={14} className="text-neutral-400" />
                          )}
                          {TYPE_LABEL[tx.type] ?? tx.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-neutral-500 text-xs max-w-[240px] truncate">
                        {tx.note ?? "-"}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-mono ${
                          positive
                            ? "text-forest"
                            : tx.amount < 0
                              ? "text-danger"
                              : "text-neutral-400"
                        }`}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {formatRupiah(tx.amount)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-neutral-600">
                        {formatRupiah(tx.balance_after)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showWithdraw && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-base">
                Tarik Dana
              </h3>
              <button
                onClick={() => setShowWithdraw(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Rekening Tujuan
                </label>
                <select
                  value={withdrawAccountId}
                  onChange={(e) => setWithdrawAccountId(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                >
                  {bankAccounts
                    .filter((a) => a.status === "active")
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bank_name} · {account.account_number} ·{" "}
                        {account.account_holder}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Nominal (min {formatRupiah(MIN_WITHDRAWAL)})
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-right font-mono focus:outline-none focus:border-forest"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  Saldo tersedia: {formatRupiah(balance.available_balance)}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Catatan (opsional)
                </label>
                <input
                  type="text"
                  value={withdrawNote}
                  onChange={(e) => setWithdrawNote(e.target.value)}
                  placeholder="Catatan untuk admin"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowWithdraw(false)}
                  className="flex-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl py-2.5 hover:bg-neutral-200"
                >
                  Batal
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={submitting}
                  className="flex-1 bg-forest text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-forest-dark disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Ajukan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAccountForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-base">
                {editingAccount ? "Edit Rekening" : "Tambah Rekening"}
              </h3>
              <button
                onClick={() => setShowAccountForm(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Nama Bank
                </label>
                <input
                  type="text"
                  value={accountBankName}
                  onChange={(e) => setAccountBankName(e.target.value)}
                  placeholder="BCA / Mandiri / BNI ..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Nomor Rekening
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="1234567890"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-forest"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Nama Pemilik Rekening
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Sesuai buku tabungan"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={accountDefault}
                  onChange={(e) => setAccountDefault(e.target.checked)}
                  className="accent-forest"
                />
                Jadikan rekening utama
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAccountForm(false)}
                  className="flex-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl py-2.5 hover:bg-neutral-200"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveAccount}
                  disabled={savingAccount}
                  className="flex-1 bg-forest text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-forest-dark disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingAccount ? (
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
