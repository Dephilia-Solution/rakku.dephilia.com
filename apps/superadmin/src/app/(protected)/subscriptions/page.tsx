"use client";

import { useEffect, useState } from "react";
import { showToast } from "@rakku/ui";
import { Search, Wallet } from "lucide-react";

interface InvoiceRow {
  id: string;
  invoice_number: string;
  amount: number;
  billing_cycle: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  companies?: { name: string; code: string } | { name: string; code: string }[] | null;
  plans?: { name: string; slug: string } | { name: string; slug: string }[] | null;
}

interface Summary {
  paidThisMonth: number;
  activeSubscriptions: number;
  trialCompanies: number;
  pendingInvoices: number;
}

interface Analytics {
  planDistribution: Record<string, number>;
  trialStarted: number;
  trialConverted: number;
  limitHit: number;
  limitConverted: number;
  revenueLast30Days: number;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  success: "Berhasil",
  expired: "Kadaluarsa",
  failed: "Gagal",
  cancelled: "Dibatalkan",
};

function embedded<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatRupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

export default function SubscriptionsPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/superadmin/subscriptions");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal memuat data");
        setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
        setSummary(data.summary ?? null);
        setAnalytics(data.analytics ?? null);
      } catch {
        showToast("error", "Gagal memuat data langganan");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = invoices.filter((invoice) => {
    if (statusFilter && invoice.status !== statusFilter) return false;
    if (!search) return true;
    const company = embedded(invoice.companies);
    const query = search.toLowerCase();
    return (
      invoice.invoice_number.toLowerCase().includes(query) ||
      (company?.name ?? "").toLowerCase().includes(query) ||
      (company?.code ?? "").toLowerCase().includes(query)
    );
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-neutral-900">
            Subscriptions
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Invoice QRIS & status langganan seluruh company.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Pendapatan bulan ini
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {formatRupiah(summary?.paidThisMonth ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Langganan aktif
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {summary?.activeSubscriptions ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Sedang trial
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {summary?.trialCompanies ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wider">
            Invoice menunggu
          </p>
          <p className="text-xl font-bold text-neutral-900 mt-1">
            {summary?.pendingInvoices ?? 0}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <h2 className="font-display font-semibold text-base text-neutral-900 mb-4">
          Analytics Konversi
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl bg-neutral-50 p-4">
            <p className="text-xs text-neutral-400 uppercase tracking-wider">
              Trial → Bayar
            </p>
            <p className="text-xl font-bold text-neutral-900 mt-1">
              {analytics?.trialConverted ?? 0}
              <span className="text-sm font-normal text-neutral-400">
                /{analytics?.trialStarted ?? 0}
              </span>
            </p>
            <p className="text-xs text-forest mt-1">
              {analytics && analytics.trialStarted > 0
                ? `${Math.round(
                    (analytics.trialConverted / analytics.trialStarted) * 100
                  )}% konversi`
                : "Belum ada data"}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4">
            <p className="text-xs text-neutral-400 uppercase tracking-wider">
              Limit → Upgrade
            </p>
            <p className="text-xl font-bold text-neutral-900 mt-1">
              {analytics?.limitConverted ?? 0}
              <span className="text-sm font-normal text-neutral-400">
                /{analytics?.limitHit ?? 0}
              </span>
            </p>
            <p className="text-xs text-forest mt-1">
              {analytics && analytics.limitHit > 0
                ? `${Math.round(
                    (analytics.limitConverted / analytics.limitHit) * 100
                  )}% konversi`
                : "Belum ada data"}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4">
            <p className="text-xs text-neutral-400 uppercase tracking-wider">
              Pendapatan 30 hari
            </p>
            <p className="text-xl font-bold text-neutral-900 mt-1">
              {formatRupiah(analytics?.revenueLast30Days ?? 0)}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4">
            <p className="text-xs text-neutral-400 uppercase tracking-wider">
              Distribusi paket
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(analytics?.planDistribution ?? {}).length === 0 ? (
                <span className="text-xs text-neutral-400">Belum ada data</span>
              ) : (
                Object.entries(analytics?.planDistribution ?? {}).map(
                  ([slug, count]) => (
                    <span
                      key={slug}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600 capitalize"
                    >
                      {slug}: {count}
                    </span>
                  )
                )
              )}
            </div>
          </div>
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
            placeholder="Cari invoice / company..."
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
          <option value="pending">Menunggu</option>
          <option value="success">Berhasil</option>
          <option value="expired">Kadaluarsa</option>
          <option value="failed">Gagal</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                Invoice
              </th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                Company
              </th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                Paket
              </th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                Siklus
              </th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                Nominal
              </th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                Tanggal
              </th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                Status
              </th>
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
                  <Wallet size={22} className="mx-auto mb-2 text-neutral-300" />
                  Belum ada invoice.
                </td>
              </tr>
            ) : (
              filtered.map((invoice) => {
                const company = embedded(invoice.companies);
                const plan = embedded(invoice.plans);
                return (
                  <tr
                    key={invoice.id}
                    className="border-b border-neutral-100 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900">
                      {company?.name ?? "-"}
                      {company?.code ? (
                        <span className="ml-2 font-mono text-[11px] text-neutral-400">
                          {company.code}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {plan?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500 capitalize">
                      {invoice.billing_cycle === "yearly" ? "Tahunan" : "Bulanan"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {formatRupiah(invoice.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500">
                      {new Date(invoice.created_at).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          invoice.status === "success"
                            ? "bg-primary-100 text-forest"
                            : invoice.status === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {STATUS_LABEL[invoice.status] ?? invoice.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
