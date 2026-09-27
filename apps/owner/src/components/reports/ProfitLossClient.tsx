"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/format";
import {
  Wallet,
  Package,
  TrendingUp,
  TrendingDown,
  Receipt,
  ShoppingBag,
} from "lucide-react";

interface OutletOption {
  id: string;
  name: string;
}

interface ProfitLossData {
  totalRevenue: number;
  totalHpp: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  totalTransactions: number;
}

interface ProfitLossClientProps {
  outlets: OutletOption[];
  dateRange: string;
  outletId: string;
  onDateRangeChange: (range: string) => void;
  onOutletChange: (outletId: string) => void;
}

export default function ProfitLossClient({
  outlets,
  dateRange,
  outletId,
  onDateRangeChange,
  onOutletChange,
}: ProfitLossClientProps) {
  const [data, setData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfitLoss = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_range: dateRange });
      if (outletId) params.set("outlet_id", outletId);
      const res = await fetch(`/api/owner/reports/profit-loss?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange, outletId]);

  useEffect(() => {
    fetchProfitLoss();
  }, [fetchProfitLoss]);

  const ranges = [
    { value: "today", label: "Hari ini" },
    { value: "yesterday", label: "Kemarin" },
    { value: "week", label: "7 Hari" },
    { value: "all", label: "Semua" },
  ];

  const cards = [
    {
      icon: ShoppingBag,
      label: "Total Omzet",
      value: data?.totalRevenue,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Package,
      label: "Total HPP",
      value: data?.totalHpp,
      color: "text-on-surface",
      bg: "bg-surface-container",
    },
    {
      icon: TrendingUp,
      label: "Laba Kotor",
      value: data?.grossProfit,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      icon: Wallet,
      label: "Total Pengeluaran",
      value: data?.totalExpenses,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      icon: TrendingDown,
      label: "Laba Bersih",
      value: data?.netProfit,
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Laporan Laba Rugi</h2>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={outletId}
            onChange={(e) => onOutletChange(e.target.value)}
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
              onClick={() => onDateRangeChange(r.value)}
              className={`flex-shrink-0 whitespace-nowrap text-xs font-medium px-3 py-2 rounded-full transition-colors ${
                dateRange === r.value
                  ? "bg-primary text-white"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-on-surface-variant">
          Memuat data...
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {cards.map((c) => (
              <div
                key={c.label}
                className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5"
              >
                <div
                  className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mb-3 ${c.color}`}
                >
                  <c.icon size={20} />
                </div>
                <p className="text-xs text-on-surface-variant mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>
                  {formatCurrency(c.value ?? 0)}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt size={18} className="text-on-surface-variant" />
              <h3 className="font-bold text-on-surface">Ringkasan</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-1.5 border-b border-surface-container">
                <span className="text-on-surface-variant">Total Transaksi Selesai</span>
                <span className="font-semibold text-on-surface">
                  {data.totalTransactions}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-surface-container">
                <span className="text-on-surface-variant">Omzet (Penjualan)</span>
                <span className="font-mono font-semibold text-primary">
                  {formatCurrency(data.totalRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-surface-container">
                <span className="text-on-surface-variant">HPP (Bahan Terpakai)</span>
                <span className="font-mono font-semibold text-on-surface">
                  − {formatCurrency(data.totalHpp)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-surface-container">
                <span className="text-on-surface-variant">Pengeluaran Operasional</span>
                <span className="font-mono font-semibold text-red-600">
                  − {formatCurrency(data.totalExpenses)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-semibold text-on-surface">Laba Bersih</span>
                <span className="font-mono font-bold text-primary">
                  {formatCurrency(data.netProfit)}
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="p-12 text-center">
          <div className="w-14 h-14 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-3">
            <TrendingDown size={28} className="text-on-surface-variant" />
          </div>
          <p className="text-sm text-on-surface-variant">
            Gagal memuat data laba rugi
          </p>
        </div>
      )}
    </div>
  );
}