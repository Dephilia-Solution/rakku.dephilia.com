"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import EmailReportModal from "@/components/reports/EmailReportModal";
import { BarChart3, TrendingUp, CupSoda, Mail, Building2 } from "lucide-react";

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
}

interface ReportsClientProps {
  outlets: OutletOption[];
  companyName: string;
}

export default function ReportsClient({ outlets, companyName }: ReportsClientProps) {
  const [dateRange, setDateRange] = useState("today");
  const [outletId, setOutletId] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const url = outletId
        ? `/api/owner/orders?outlet_id=${encodeURIComponent(outletId)}`
        : "/api/owner/orders";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const today = new Date();
  const filtered = orders.filter((o) => {
    const d = new Date(o.created_at);
    if (dateRange === "today") return d.toDateString() === today.toDateString();
    if (dateRange === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return d.toDateString() === y.toDateString();
    }
    if (dateRange === "week") {
      const w = new Date(today);
      w.setDate(w.getDate() - 7);
      return d >= w;
    }
    return true;
  });

  const totalRevenue = filtered.reduce((s, o) => s + o.total_price, 0);
  const totalTransactions = filtered.length;

  const itemCounts: Record<string, number> = {};
  filtered.forEach((o) =>
    o.items.forEach((i) => {
      itemCounts[i.product_name] =
        (itemCounts[i.product_name] || 0) + i.quantity;
    })
  );
  const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];

  const ranges = [
    { value: "today", label: "Hari ini" },
    { value: "yesterday", label: "Kemarin" },
    { value: "week", label: "7 Hari" },
    { value: "all", label: "Semua" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Laporan Penjualan</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Ringkasan penjualan {companyName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
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
              onClick={() => setDateRange(r.value)}
              className={`flex-shrink-0 whitespace-nowrap text-xs font-medium px-3 py-2 rounded-full transition-colors ${
                dateRange === r.value
                  ? "bg-forest text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {r.label}
            </button>
          ))}

          <button
            onClick={() => setShowEmailModal(true)}
            className="flex-shrink-0 whitespace-nowrap text-xs font-medium px-3 py-2 rounded-full transition-colors bg-neutral-100 text-neutral-600 hover:bg-neutral-200 flex items-center gap-1.5"
          >
            <Mail size={13} />
            Kirim Email
          </button>
        </div>
      </div>

      <EmailReportModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        dateRange={dateRange}
        outletId={outletId || undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center mb-3 text-forest">
            <BarChart3 size={20} />
          </div>
          <p className="text-xs text-neutral-400 mb-1">Total Transaksi</p>
          <p className="text-2xl font-bold text-neutral-900">
            {loading ? "—" : totalTransactions}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center mb-3 text-forest">
            <TrendingUp size={20} />
          </div>
          <p className="text-xs text-neutral-400 mb-1">Total Pendapatan</p>
          <p className="text-2xl font-bold text-forest">
            {loading ? "—" : formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center mb-3 text-forest">
            <CupSoda size={20} />
          </div>
          <p className="text-xs text-neutral-400 mb-1">Item Terlaris</p>
          <p className="text-2xl font-bold text-neutral-900">
            {loading || !topItem ? "-" : `${topItem[0]} (${topItem[1]})`}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="p-5 border-b border-neutral-100">
          <h3 className="font-bold text-neutral-900">Detail Transaksi</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-neutral-400">
            Memuat data...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <BarChart3 size={28} className="text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-400">
              Tidak ada transaksi di periode ini
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    {["Order", "Waktu", "Outlet", "Items", "Metode", "Total"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtered.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-3 font-mono text-sm font-semibold text-neutral-900">
                        #{order.order_number}
                      </td>
                      <td className="px-6 py-3 text-sm text-neutral-600">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
                          <Building2 size={12} className="text-neutral-400" />
                          {order.outlet_name || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-neutral-600">
                        {order.items.length} item
                      </td>
                      <td className="px-6 py-3 text-sm text-neutral-600 capitalize">
                        {order.payment_method}
                      </td>
                      <td className="px-6 py-3 font-mono text-sm font-semibold text-neutral-900">
                        {formatCurrency(order.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-neutral-100">
              {filtered.map((order) => (
                <div key={order.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-semibold text-neutral-900">
                      #{order.order_number}
                    </span>
                    <span className="font-mono text-sm font-bold text-forest">
                      {formatCurrency(order.total_price)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Building2 size={11} />
                      {order.outlet_name || "-"}
                    </span>
                    <span>&middot;</span>
                    <span>{formatDate(order.created_at)}</span>
                    <span>&middot;</span>
                    <span>{order.items.length} item</span>
                    <span className="text-[10px] capitalize bg-neutral-100 rounded-full px-2 py-0.5">
                      {order.payment_method}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
