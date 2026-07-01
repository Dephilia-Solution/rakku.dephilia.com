"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/dummy-data";
import { OrderWithItems } from "@/types";
import Badge from "@/components/shared/Badge";
import EmptyState from "@/components/shared/EmptyState";
import { Search, ClipboardList, ChevronDown, ChevronUp, Printer } from "lucide-react";
import Link from "next/link";

const orderTypeLabels: Record<string, string> = {
  dine_in: "Walk-in",
  delivery: "Delivery",
};

const paymentLabels: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
  card: "Kartu",
};

const orderTypeLabelsAll: Record<string, string> = {
  dine_in: "Dine In",
  take_away: "Take Away",
  delivery: "Delivery",
  gojek: "Gojek",
  grab: "Grab",
  shopee: "Shopee",
};

interface OrdersClientProps {
  orders: OrderWithItems[];
}

export default function OrdersClient({ orders }: OrdersClientProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filtered = orders.filter((o) => {
    if (filter !== "all") {
      const today = new Date();
      const orderDate = new Date(o.created_at);
      if (filter === "today") {
        if (orderDate.toDateString() !== today.toDateString()) return false;
      }
      if (filter === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (orderDate < weekAgo) return false;
      }
    }
    if (search) {
      return `#${o.order_number}`.includes(search);
    }
    return true;
  });

  const totalRevenue = filtered.reduce((s, o) => s + o.total_price, 0);
  const totalOrders = filtered.length;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h1 className="font-display font-bold text-xl sm:text-2xl text-neutral-900">
          Pesanan
        </h1>
        <div className="flex gap-2">
          {["all", "today", "week"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                filter === f
                  ? "bg-forest text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {f === "all" ? "Semua" : f === "today" ? "Hari ini" : "7 Hari"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Transaksi", value: totalOrders, color: "text-forest" },
          { label: "Total Pendapatan", value: formatCurrency(totalRevenue), color: "text-forest" },
          { label: "Rata-rata", value: formatCurrency(avgOrder), color: "text-neutral-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-neutral-400 mb-1">{stat.label}</p>
            <p className={`font-display font-bold text-lg ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          placeholder="Cari nomor order..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs bg-white border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 sm:py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Belum ada pesanan"
          description="Tidak ada transaksi di periode ini"
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  {["Order", "Waktu", "Tipe", "Items", "Kasir", "Pembayaran", "Total", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const isExpanded = expandedId === order.id;
                  return (
                    <>
                      <tr
                        key={order.id}
                        onClick={() =>
                          setExpandedId(isExpanded ? null : order.id)
                        }
                        className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-neutral-900">
                          #{order.order_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              order.order_type === "delivery" || order.order_type === "gojek" || order.order_type === "grab" || order.order_type === "shopee"
                                ? "warning"
                                : "active"
                            }
                          >
                            {orderTypeLabelsAll[order.order_type] ?? order.order_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600">
                          {order.items.length} item
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600">
                          {order.cashier_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600">
                          {paymentLabels[order.payment_method] ?? order.payment_method}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-neutral-900">
                          {formatCurrency(order.total_price)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/orders/${order.id}/invoice`}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-forest hover:bg-forest/5 transition-colors"
                              title="Print Invoice"
                            >
                              <Printer size={14} />
                            </Link>
                            <span className="text-neutral-300">
                              {isExpanded ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${order.id}-detail`}>
                          <td colSpan={8} className="px-4 py-3 bg-neutral-50">
                            <div className="pl-4 border-l-2 border-forest/30 space-y-2">
                              {order.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <div>
                                    <span className="text-neutral-900 font-medium">
                                      {item.product_name}
                                    </span>
                                    {item.modifier_label && (
                                      <span className="text-neutral-400 text-xs ml-2">
                                        ({item.modifier_label})
                                      </span>
                                    )}
                                    <span className="text-neutral-400 ml-2">
                                      x{item.quantity}
                                    </span>
                                  </div>
                                  <span className="font-mono text-neutral-900">
                                    {formatCurrency(item.subtotal)}
                                  </span>
                                </div>
                              ))}
                              {order.note && (
                                <p className="text-xs text-neutral-400 italic mt-2">
                                  Catatan: {order.note}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((order) => {
              const isExpanded = expandedId === order.id;
              return (
                <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    className="w-full text-left px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-neutral-900">
                        #{order.order_number}
                      </span>
                      <Badge
                        variant={order.order_type === "delivery" || order.order_type === "gojek" || order.order_type === "grab" || order.order_type === "shopee" ? "warning" : "active"}
                      >
                        {orderTypeLabelsAll[order.order_type] ?? order.order_type}
                      </Badge>
                    </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/orders/${order.id}/invoice`}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-forest transition-colors"
                          title="Print Invoice"
                        >
                          <Printer size={14} />
                        </Link>
                        <span className="font-mono font-semibold text-sm text-forest">
                          {formatCurrency(order.total_price)}
                        </span>
                        {isExpanded ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
                      </div>
                  </button>
                  <div className="px-4 pb-2 flex items-center gap-3 text-xs text-neutral-400">
                    <span>{formatDate(order.created_at)}</span>
                    <span>&middot;</span>
                    <span>{order.items.length} item</span>
                    <span>&middot;</span>
                    <span>{paymentLabels[order.payment_method] ?? order.payment_method}</span>
                    {order.cashier_name && (
                      <>
                        <span>&middot;</span>
                        <span>{order.cashier_name}</span>
                      </>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 border-t border-neutral-100">
                      <div className="pl-3 border-l-2 border-forest/30 space-y-1.5">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-neutral-900 font-medium truncate">{item.product_name}</span>
                              {item.modifier_label && (
                                <span className="text-neutral-400">({item.modifier_label})</span>
                              )}
                              <span className="text-neutral-400">x{item.quantity}</span>
                            </div>
                            <span className="font-mono text-neutral-900 whitespace-nowrap ml-2">{formatCurrency(item.subtotal)}</span>
                          </div>
                        ))}
                        {order.note && (
                          <p className="text-xs text-neutral-400 italic mt-1">Catatan: {order.note}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
