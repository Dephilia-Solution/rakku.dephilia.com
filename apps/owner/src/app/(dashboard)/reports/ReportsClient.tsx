"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Tabs } from "@rakku/ui";
import { isWithinJakartaRange, type ReportRange } from "@rakku/shared-types";
import { useMerchantRequest, useMerchantRuntime, useSearchParams } from "@/lib/merchant-runtime";
import EmailReportModal from "@/components/reports/EmailReportModal";
import ProfitLossClient from "@/components/reports/ProfitLossClient";
import { usePlan } from "@/components/billing/PlanProvider";
import { BarChart3, TrendingUp, CupSoda, Mail, Building2, Lock } from "lucide-react";

interface OutletOption {
  id: string;
  name: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Order {
  id: string;
  order_number: number;
  total_price: number;
  created_at: string;
  payment_method: string;
  outlet_name: string;
  items: OrderItem[];
  item_count?: number;
}

interface ReportsClientProps {
  outlets: OutletOption[];
  companyName: string;
}

export default function ReportsClient({ outlets, companyName }: ReportsClientProps) {
  const request = useMerchantRequest();
  const searchParams = useSearchParams();
  const runtime = useMerchantRuntime();
  const isActive = runtime?.active;
  const { hasFeature, openUpgrade } = usePlan();
  const [activeTab, setActiveTab] = useState("penjualan");
  const [dateRange, setDateRange] = useState(() => ["today", "yesterday", "week", "month", "all"].includes(searchParams.get("range") ?? "") ? searchParams.get("range")! : "today");
  const [outletId, setOutletId] = useState<string>(() => outlets.some(outlet => outlet.id === searchParams.get("outlet")) ? searchParams.get("outlet")! : "");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<{ totalRevenue: number; totalTransactions: number; topItem: { name: string; count: number } | null } | null>(null);

  const fetchOrders = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted || isActive?.() === false) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ range: dateRange, page: String(page) });
      if (outletId) params.set("outlet_id", outletId);
      const url = runtime
        ? `/api/owner/orders${outletId ? `?outlet_id=${encodeURIComponent(outletId)}` : ""}`
        : `/api/owner/reports/sales?${params}`;
      const res = await request(url, { signal });
      if (res.ok) {
        const data = await res.json();
        if (signal?.aborted || isActive?.() === false) return;
        setOrders(data.orders ?? []);
        setSummary(data.summary ?? null);
      } else {
        setOrders([]);
        setSummary(null);
      }
    } catch {
      if (signal?.aborted || isActive?.() === false) return;
      setOrders([]);
      setSummary(null);
    } finally {
      if (!signal?.aborted && isActive?.() !== false) setLoading(false);
    }
  }, [outletId, dateRange, page, request, isActive, runtime]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchOrders(controller.signal);
    return () => controller.abort();
  }, [fetchOrders]);

  const filtered = runtime ? orders.filter(o => isWithinJakartaRange(o.created_at, dateRange as ReportRange)) : orders;

  const totalRevenue = summary?.totalRevenue ?? filtered.reduce((s, o) => s + o.total_price, 0);
  const totalTransactions = summary?.totalTransactions ?? filtered.length;

  const itemCounts: Record<string, number> = {};
  filtered.forEach((o) =>
    (o.items ?? []).forEach((i) => {
      itemCounts[i.product_name] =
        (itemCounts[i.product_name] || 0) + i.quantity;
    })
  );
  const topItem = summary?.topItem ? [summary.topItem.name, summary.topItem.count] : Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];
  const changeRange = (value: string) => { setDateRange(value); setPage(1); };
  const changeOutlet = (value: string) => { setOutletId(value); setPage(1); };

  const ranges = [
    { value: "today", label: "Hari ini" },
    { value: "yesterday", label: "Kemarin" },
    { value: "week", label: "7 Hari" },
    { value: "month", label: "Bulan Ini" },
    { value: "all", label: "Semua" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Laporan</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {companyName}
          </p>
        </div>
        <Tabs
          tabs={[
            { key: "penjualan", label: "Penjualan" },
            ...(hasFeature("profit_loss")
              ? [{ key: "laba-rugi", label: "Laba Rugi" }]
              : []),
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === "penjualan" ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Laporan Penjualan</h2>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={outletId}
                onChange={(e) => changeOutlet(e.target.value)}
                className="bg-surface-container-lowest border border-surface-container rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Semua Outlet</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>

              {ranges.map((r) => (
                <button
                  key={r.value}
                  onClick={() => changeRange(r.value)}
                  className={`flex-shrink-0 whitespace-nowrap text-xs font-medium px-3 py-2 rounded-full transition-colors ${
                    dateRange === r.value
                      ? "bg-primary text-white"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {r.label}
                </button>
              ))}

              {hasFeature("email_reports") ? (
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="flex-shrink-0 whitespace-nowrap text-xs font-medium px-3 py-2 rounded-full transition-colors bg-surface-container text-on-surface-variant hover:bg-surface-container-high flex items-center gap-1.5"
                >
                  <Mail size={13} />
                  Kirim Email
                </button>
              ) : (
                <button
                  onClick={() =>
                    openUpgrade("Kirim laporan via email tersedia di paket Pro.")
                  }
                  className="flex-shrink-0 whitespace-nowrap text-xs font-medium px-3 py-2 rounded-full transition-colors bg-surface-container text-on-surface-variant/70 hover:bg-surface-container-high flex items-center gap-1.5"
                >
                  <Lock size={13} />
                  Kirim Email
                </button>
              )}
            </div>
          </div>

          <EmailReportModal
            isOpen={showEmailModal}
            onClose={() => setShowEmailModal(false)}
            dateRange={dateRange}
            outletId={outletId || undefined}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 text-primary">
                <BarChart3 size={20} />
              </div>
              <p className="text-xs text-on-surface-variant mb-1">Total Transaksi</p>
              <p className="text-2xl font-bold text-on-surface">
                {loading ? "—" : totalTransactions}
              </p>
            </div>
            <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 text-primary">
                <TrendingUp size={20} />
              </div>
              <p className="text-xs text-on-surface-variant mb-1">Total Pendapatan</p>
              <p className="text-2xl font-bold text-primary">
                {loading ? "—" : formatCurrency(totalRevenue)}
              </p>
            </div>
            <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 text-primary">
                <CupSoda size={20} />
              </div>
              <p className="text-xs text-on-surface-variant mb-1">Item Terlaris</p>
              <p className="text-2xl font-bold text-on-surface">
                {loading || !topItem ? "-" : `${topItem[0]} (${topItem[1]})`}
              </p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden">
            <div className="p-5 border-b border-surface-container">
              <h3 className="font-bold text-on-surface">Detail Transaksi</h3>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-on-surface-variant">
                Memuat data...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <BarChart3 size={28} className="text-on-surface-variant" />
                </div>
                <p className="text-sm text-on-surface-variant">
                  Tidak ada transaksi di periode ini
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface-container-low border-b border-surface-container">
                      <tr>
                        {["Order", "Waktu", "Outlet", "Items", "Metode", "Total"].map((h) => (
                          <th
                            key={h}
                            className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-6 py-3"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      {filtered.map((order) => (
                        <tr key={order.id} className="hover:bg-surface-container-low">
                          <td className="px-6 py-3 font-mono text-sm font-semibold text-on-surface">
                            #{order.order_number}
                          </td>
                          <td className="px-6 py-3 text-sm text-on-surface-variant">
                            {formatDate(order.created_at)}
                          </td>
                          <td className="px-6 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
                              <Building2 size={12} className="text-on-surface-variant" />
                              {order.outlet_name || "-"}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-on-surface-variant">
                            {order.item_count ?? order.items?.length ?? 0} item
                          </td>
                          <td className="px-6 py-3 text-sm text-on-surface-variant capitalize">
                            {order.payment_method}
                          </td>
                          <td className="px-6 py-3 font-mono text-sm font-semibold text-on-surface">
                            {formatCurrency(order.total_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-surface-container">
                  {filtered.map((order) => (
                    <div key={order.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm font-semibold text-on-surface">
                          #{order.order_number}
                        </span>
                        <span className="font-mono text-sm font-bold text-primary">
                          {formatCurrency(order.total_price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Building2 size={11} />
                          {order.outlet_name || "-"}
                        </span>
                        <span>&middot;</span>
                        <span>{formatDate(order.created_at)}</span>
                        <span>&middot;</span>
                        <span>{order.item_count ?? order.items?.length ?? 0} item</span>
                        <span className="text-[10px] capitalize bg-surface-container rounded-full px-2 py-0.5">
                          {order.payment_method}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {!runtime && totalTransactions > 50 && (
            <nav aria-label="Halaman laporan" className="flex items-center justify-between gap-4 text-sm">
              <button type="button" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)} className="min-h-11 rounded-xl border border-surface-container px-4 disabled:opacity-40">Sebelumnya</button>
              <span>Halaman {page} / {Math.max(1, Math.ceil(totalTransactions / 50))}</span>
              <button type="button" disabled={loading || page * 50 >= totalTransactions} onClick={() => setPage(value => value + 1)} className="min-h-11 rounded-xl border border-surface-container px-4 disabled:opacity-40">Berikutnya</button>
            </nav>
          )}
        </>
      ) : hasFeature("profit_loss") ? (
        <ProfitLossClient
          outlets={outlets}
          dateRange={dateRange}
          outletId={outletId}
          onDateRangeChange={changeRange}
          onOutletChange={changeOutlet}
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-12 text-center">
          <div className="w-14 h-14 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Lock size={26} className="text-on-surface-variant" />
          </div>
          <p className="font-semibold text-on-surface">
            Laporan Laba Rugi tersedia di paket Pro
          </p>
          <p className="text-sm text-on-surface-variant mt-1">
            Hitung HPP dari resep, pengeluaran, dan laba bersih otomatis.
          </p>
          <button
            onClick={() =>
              openUpgrade("Laporan Laba Rugi tersedia di paket Pro.")
            }
            className="mt-4 rounded-xl bg-forest text-white px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark"
          >
            Lihat paket
          </button>
        </div>
      )}
    </div>
  );
}
