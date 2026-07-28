"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge, EmptyState } from "@rakku/ui";
import {
  Search,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Printer,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";
import Link from "next/link";

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

interface OutletOption {
  id: string;
  name: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  modifier_label: string | null;
  note: string | null;
  subtotal: number;
}

interface Order {
  id: string;
  order_number: number;
  order_type: string;
  payment_method: string;
  total_price: number;
  customer_name: string;
  cashier_name: string | null;
  created_at: string;
  outlet_id: string;
  outlet_name: string;
  items: OrderItem[];
}

interface OrdersClientProps {
  outlets: OutletOption[];
}

export default function OrdersClient({ outlets }: OrdersClientProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [outletId, setOutletId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilter = (val: string) => {
    setFilter(val);
    setPage(1);
  };

  const handlePerPage = (val: number) => {
    setPerPage(val);
    setPage(1);
  };

  const handleOutlet = (val: string) => {
    setOutletId(val);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Pesanan</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Semua transaksi dari seluruh outlet
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={outletId}
            onChange={(e) => handleOutlet(e.target.value)}
            className="bg-surface-container-lowest border border-surface-container rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="">Semua Outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          {["all", "today", "week"].map((f) => (
            <button
              key={f}
              onClick={() => handleFilter(f)}
              className={`text-xs font-medium px-3 py-2 rounded-full transition-colors ${
                filter === f
                  ? "bg-primary text-white"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {f === "all" ? "Semua" : f === "today" ? "Hari ini" : "7 Hari"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Transaksi", value: loading ? "—" : String(totalOrders), color: "text-on-surface" },
          { label: "Total Pendapatan", value: loading ? "—" : formatCurrency(totalRevenue), color: "text-primary" },
          { label: "Rata-rata", value: loading ? "—" : formatCurrency(avgOrder), color: "text-on-surface-variant" },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5">
            <p className="text-xs text-on-surface-variant mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          type="text"
          placeholder="Cari nomor order..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full sm:max-w-xs bg-surface-container-lowest border border-surface-container rounded-xl pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {loading ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-12 text-center text-sm text-on-surface-variant">
          Memuat data...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Belum ada pesanan"
          description="Tidak ada transaksi di periode ini"
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-container bg-surface-container-low">
                  {["Order", "Waktu", "Outlet", "Tipe", "Items", "Kasir", "Pembayaran", "Total", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((order) => {
                  const isExpanded = expandedId === order.id;
                  return (
                    <Fragment key={order.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        className="border-b border-surface-container hover:bg-surface-container-low cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-on-surface">
                          #{order.order_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
                            <Building2 size={12} className="text-on-surface-variant" />
                            {order.outlet_name || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              order.order_type === "delivery" ||
                              order.order_type === "gojek" ||
                              order.order_type === "grab" ||
                              order.order_type === "shopee"
                                ? "warning"
                                : "active"
                            }
                          >
                            {orderTypeLabelsAll[order.order_type] ?? order.order_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">
                          {order.items.length} item
                        </td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">
                          {order.cashier_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">
                          {paymentLabels[order.payment_method] ?? order.payment_method}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-on-surface">
                          {formatCurrency(order.total_price)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/orders/${order.id}/invoice`}
                              className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors"
                              title="Print Invoice"
                            >
                              <Printer size={14} />
                            </Link>
                            <span className="text-on-surface-variant/50">
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
                          <td colSpan={9} className="px-4 py-3 bg-surface-container-low">
                            <div className="pl-4 border-l-2 border-primary/30 space-y-2">
                              {order.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <div>
                                    <span className="text-on-surface font-medium">
                                      {item.product_name}
                                    </span>
                                    {item.modifier_label && (
                                      <span className="text-on-surface-variant text-xs ml-2">
                                        ({item.modifier_label})
                                      </span>
                                    )}
                                    {item.note && (
                                      <span className="text-on-surface-variant text-xs italic ml-2">
                                        — {item.note}
                                      </span>
                                    )}
                                    <span className="text-on-surface-variant ml-2">
                                      x{item.quantity}
                                    </span>
                                  </div>
                                  <span className="font-mono text-on-surface">
                                    {formatCurrency(item.subtotal)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="grid gap-3 md:hidden">
            {paginated.map((order) => {
              const isExpanded = expandedId === order.id;
              return (
                <div key={order.id} className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    className="w-full text-left px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-on-surface">
                        #{order.order_number}
                      </span>
                      <Badge
                        variant={
                          order.order_type === "delivery" ||
                          order.order_type === "gojek" ||
                          order.order_type === "grab" ||
                          order.order_type === "shopee"
                            ? "warning"
                            : "active"
                        }
                      >
                        {orderTypeLabelsAll[order.order_type] ?? order.order_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/orders/${order.id}/invoice`}
                        className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary transition-colors"
                        title="Print Invoice"
                      >
                        <Printer size={14} />
                      </Link>
                      <span className="font-mono font-semibold text-sm text-primary">
                        {formatCurrency(order.total_price)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-on-surface-variant" />
                      ) : (
                        <ChevronDown size={16} className="text-on-surface-variant" />
                      )}
                    </div>
                  </button>
                  <div className="px-4 pb-2 flex items-center gap-2 flex-wrap text-xs text-on-surface-variant">
                    <span className="inline-flex items-center gap-1">
                      <Building2 size={11} />
                      {order.outlet_name || "-"}
                    </span>
                    <span>&middot;</span>
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
                    <div className="px-4 pb-3 pt-1 border-t border-surface-container">
                      <div className="pl-3 border-l-2 border-primary/30 space-y-1.5">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-on-surface font-medium truncate">
                                {item.product_name}
                              </span>
                              {item.modifier_label && (
                                <span className="text-on-surface-variant">({item.modifier_label})</span>
                              )}
                              {item.note && (
                                <span className="text-on-surface-variant italic">— {item.note}</span>
                              )}
                              <span className="text-on-surface-variant">x{item.quantity}</span>
                            </div>
                            <span className="font-mono text-on-surface whitespace-nowrap ml-2">
                              {formatCurrency(item.subtotal)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1">
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span>Show</span>
              <select
                value={perPage}
                onChange={(e) => handlePerPage(Number(e.target.value))}
                className="bg-surface-container-lowest border border-surface-container rounded-lg px-2 py-1 text-sm text-on-surface focus:outline-none focus:border-primary"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>of {filtered.length} orders</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={p} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="px-1 text-on-surface-variant/50">...</span>
                    )}
                    <button
                      onClick={() => setPage(p)}
                      className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                        page === p
                          ? "bg-primary text-white"
                          : "text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
        </>
      )}
    </div>
  );
}
