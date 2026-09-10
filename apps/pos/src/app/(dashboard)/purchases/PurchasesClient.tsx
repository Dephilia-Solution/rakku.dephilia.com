"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  Badge,
} from "@rakku/ui";
import {
  Plus,
  Search,
  ShoppingBag,
  PackagePlus,
} from "lucide-react";

interface PurchaseItemView {
  ingredient_id: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  ingredient_name: string;
  ingredient_unit: string;
}

interface PurchaseView {
  id: string;
  supplier_name: string | null;
  total_amount: number;
  purchase_date: string;
  note: string | null;
  items: PurchaseItemView[];
}

interface Props {
  purchases: PurchaseView[];
}

export default function PurchasesClient({ purchases: initialPurchases }: Props) {
  const [search, setSearch] = useState("");
  const purchases = initialPurchases;

  const filtered = purchases.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.supplier_name ?? "").toLowerCase().includes(q) ||
      (p.note ?? "").toLowerCase().includes(q) ||
      p.items.some((i) => i.ingredient_name.toLowerCase().includes(q))
    );
  });

  const totalAll = filtered.reduce((sum, p) => sum + p.total_amount, 0);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Pembelian Bahan"
        subtitle="Catat pembelian/restock bahan baku. Stok dan harga beli otomatis ter-update."
        actions={
          <Link
            href="/purchases/add"
            className="px-4 md:px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 hover:bg-primary/90 transition-all"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Tambah Pembelian</span>
            <span className="sm:hidden">Tambah</span>
          </Link>
        }
      />

      {/* Total ringkasan */}
      <div className="bg-surface-container-lowest rounded-xl p-5 mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
            <ShoppingBag size={22} className="text-primary" />
          </div>
          <div>
            <p className="text-label-caps uppercase text-on-surface-variant">
              Total Pembelian
            </p>
            <p className="text-headline-sm font-bold text-on-surface font-mono">
              {formatCurrency(totalAll)}
            </p>
          </div>
        </div>
        <Badge variant="active">
          {filtered.length} {filtered.length === 1 ? "transaksi" : "transaksi"}
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            placeholder="Cari supplier, bahan, atau catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-lowest border-none rounded-lg pl-11 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary outline-none transition-all"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl">
          <EmptyState
            icon={PackagePlus}
            title="Belum ada pembelian"
            description="Catat pembelian bahan pertama Anda"
          />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-container">
                  {["Tanggal", "Supplier", "Bahan", "Total", "Catatan"].map((h) => (
                    <th
                      key={h}
                      className={`text-label-caps uppercase text-on-surface-variant px-6 py-4 ${
                        h === "Total" ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-on-surface-variant whitespace-nowrap">
                      {new Date(p.purchase_date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-on-surface">
                      {p.supplier_name || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[320px]">
                        {p.items.map((i, idx) => (
                          <span
                            key={`${i.ingredient_id}-${idx}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-xs text-on-surface-variant"
                          >
                            {i.ingredient_name}
                            <span className="font-mono">
                              {i.quantity} {i.ingredient_unit}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm font-semibold text-on-surface text-right">
                      {formatCurrency(p.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant truncate max-w-[200px]">
                      {p.note || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((p) => (
              <div key={p.id} className="bg-surface-container-lowest rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {p.supplier_name || "Tanpa supplier"}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {new Date(p.purchase_date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-on-surface shrink-0">
                    {formatCurrency(p.total_amount)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.items.map((i, idx) => (
                    <span
                      key={`${i.ingredient_id}-${idx}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-xs text-on-surface-variant"
                    >
                      {i.ingredient_name}
                      <span className="font-mono">
                        {i.quantity} {i.ingredient_unit}
                      </span>
                    </span>
                  ))}
                </div>
                {p.note && (
                  <p className="mt-2 text-sm text-on-surface-variant">{p.note}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}