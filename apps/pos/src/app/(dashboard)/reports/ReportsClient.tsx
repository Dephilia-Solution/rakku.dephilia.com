"use client";

import { useState } from "react";
import { OrderWithItems } from "@rakku/shared-types";
import { formatCurrency, formatDate } from "@/lib/dummy-data";
import EmailReportModal from "@/components/reports/EmailReportModal";
import { BarChart3, TrendingUp, CupSoda, Mail } from "lucide-react";

export default function ReportsClient({ orders }: { orders: OrderWithItems[] }) {
  const [dateRange, setDateRange] = useState("today");
  const [showEmailModal, setShowEmailModal] = useState(false);

  const today = new Date();
  const filtered = orders.filter((o) => {
    const d = new Date(o.created_at);
    if (dateRange === "today")
      return d.toDateString() === today.toDateString();
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h1 className="font-display font-bold text-xl sm:text-2xl text-neutral-900">
          Laporan Penjualan
        </h1>
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setDateRange(r.value)}
              className={`whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
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
            className="whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-full transition-colors bg-neutral-100 text-neutral-600 hover:bg-neutral-200 flex items-center gap-1.5"
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
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center mb-3">
            <BarChart3 size={20} className="text-forest" />
          </div>
          <p className="text-xs text-neutral-400 mb-1">Total Transaksi</p>
          <p className="font-display font-bold text-2xl text-neutral-900">
            {totalTransactions}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center mb-3">
            <TrendingUp size={20} className="text-forest" />
          </div>
          <p className="text-xs text-neutral-400 mb-1">Total Pendapatan</p>
          <p className="font-display font-bold text-2xl text-forest">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center mb-3">
            <CupSoda size={20} className="text-forest" />
          </div>
          <p className="text-xs text-neutral-400 mb-1">Item Terlaris</p>
          <p className="font-display font-bold text-2xl text-neutral-900">
            {topItem
              ? `${topItem[0]} (${topItem[1]})`
              : "-"}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
        <h3 className="font-display font-semibold text-base text-neutral-900 mb-4">
          Detail Transaksi
        </h3>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200">
                {["Order", "Waktu", "Items", "Metode", "Total"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-3 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center text-sm text-neutral-400 py-8"
                  >
                    Tidak ada transaksi di periode ini
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="px-3 py-3 font-mono text-sm font-semibold text-neutral-900">
                      #{order.order_number}
                    </td>
                    <td className="px-3 py-3 text-sm text-neutral-600">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-3 py-3 text-sm text-neutral-600">
                      {order.items.length} item
                    </td>
                    <td className="px-3 py-3 text-sm text-neutral-600 capitalize">
                      {order.payment_method}
                    </td>
                    <td className="px-3 py-3 font-mono text-sm font-semibold text-neutral-900">
                      {formatCurrency(order.total_price)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="space-y-2 md:hidden">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-neutral-400 py-8">
              Tidak ada transaksi di periode ini
            </p>
          ) : (
            filtered.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-xl bg-neutral-50"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-neutral-900">
                      #{order.order_number}
                    </span>
                    <span className="text-[10px] capitalize text-neutral-400 bg-neutral-200 rounded-full px-2 py-0.5">
                      {order.payment_method}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-400">
                    {formatDate(order.created_at)} &middot; {order.items.length} item
                  </span>
                </div>
                <span className="font-mono text-sm font-bold text-forest">
                  {formatCurrency(order.total_price)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 mt-4">
        <h3 className="font-display font-semibold text-base text-neutral-900 mb-4">
          Penjualan per Hari
        </h3>
        <div className="flex items-end gap-2 sm:gap-3 h-32 overflow-x-auto pb-2">
          {[40, 65, 35, 80, 55, 90, 45, 70, 50, 85, 60, 75].map(
            (height, i) => (
              <div
                key={i}
                className="flex-1 bg-primary-100 rounded-t-lg relative group"
                style={{ height: `${height}%` }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Rp{height * 1000}
                </div>
              </div>
            )
          )}
        </div>
        <div className="flex gap-3 mt-2">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
            <div
              key={d}
              className="flex-1 text-center text-[10px] text-neutral-400"
            >
              {d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
