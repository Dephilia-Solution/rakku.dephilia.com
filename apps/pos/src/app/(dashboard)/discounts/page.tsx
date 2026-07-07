"use client";

import { useState, useEffect, useCallback } from "react";
import { ProductDiscount, OrderDiscount } from "@rakku/shared-types";
import { showToast } from "@rakku/ui";
import DiscountManager from "@/components/admin/DiscountManager";
import { Plus, Pencil, Trash2, Percent } from "lucide-react";

type TabType = "product" | "order";

export default function DiscountsPage() {
  const [tab, setTab] = useState<TabType>("product");
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscount[]>([]);
  const [orderDiscounts, setOrderDiscounts] = useState<OrderDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManager, setShowManager] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<(ProductDiscount | OrderDiscount) | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/discounts");
      if (res.ok) {
        const data = await res.json();
        setProductDiscounts(data.productDiscounts ?? []);
        setOrderDiscounts(data.orderDiscounts ?? []);
      }
    } catch {
      showToast("error", "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingDiscount(null);
    setShowManager(true);
  };

  const handleEdit = (discount: ProductDiscount | OrderDiscount) => {
    setEditingDiscount(discount);
    setShowManager(true);
  };

  const handleDelete = async (id: string, scope: "product" | "order") => {
    if (!confirm("Hapus diskon ini?")) return;
    try {
      const res = await fetch(`/api/admin/discounts?id=${id}&scope=${scope}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Diskon berhasil dihapus");
        fetchData();
      } else {
        const data = await res.json();
        showToast("error", data.error ?? "Gagal menghapus");
      }
    } catch {
      showToast("error", "Gagal menghapus");
    }
  };

  const handleSave = async (data: {
    scope: "product" | "order";
    product_id?: string;
    name: string;
    type: "percentage" | "fixed";
    value: number;
    start_date: string;
    end_date: string;
  }) => {
    if (editingDiscount) {
      const res = await fetch("/api/admin/discounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingDiscount.id, ...data }),
      });
      if (!res.ok) throw new Error("Gagal update");
    } else {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Gagal tambah");
    }
  };

  const now = new Date();
  const isActive = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    return now >= s && now <= e;
  };

  const discounts = tab === "product" ? productDiscounts : orderDiscounts;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold text-neutral-900">
            Kelola Diskon
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Atur diskon produk dan diskon pesanan
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 bg-forest text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-forest-dark transition-colors"
        >
          <Plus size={16} />
          Tambah Diskon
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("product")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === "product"
              ? "bg-forest text-white shadow-sm"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          Diskon Produk
        </button>
        <button
          onClick={() => setTab("order")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === "order"
              ? "bg-forest text-white shadow-sm"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          Diskon Pesanan
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-neutral-400 text-sm">Memuat...</div>
      ) : discounts.length === 0 ? (
        <div className="text-center py-12 text-neutral-400 text-sm border border-dashed border-neutral-200 rounded-xl">
          <Percent size={32} className="mx-auto mb-2 opacity-50" />
          Belum ada {tab === "product" ? "diskon produk" : "diskon pesanan"}. Klik &quot;Tambah Diskon&quot; untuk memulai.
        </div>
      ) : (
        <div className="space-y-2">
          {discounts.map((discount) => {
            const d = discount as ProductDiscount;
            const active = isActive(d.start_date, d.end_date);
            return (
              <div
                key={d.id}
                className="flex items-center justify-between bg-white rounded-xl border border-neutral-200 px-4 py-3 hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-neutral-900">
                      {d.name}
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">
                      {d.type === "percentage" ? `${d.value}%` : `Rp ${d.value.toLocaleString("id-ID")}`}
                      {tab === "product" && (d as ProductDiscount).product_id && " — " + (d as ProductDiscount).product_id?.slice(0, 8) + "..."}
                    </span>
                    <span className="text-[10px] text-neutral-400 mt-0.5">
                      {new Date(d.start_date).toLocaleDateString("id-ID")} — {new Date(d.end_date).toLocaleDateString("id-ID")}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    active
                      ? "bg-success/10 text-success"
                      : "bg-neutral-100 text-neutral-400"
                  }`}>
                    {active ? "Aktif" : "Kadaluarsa"}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    d.is_active
                      ? "bg-blue-50 text-blue-600"
                      : "bg-neutral-100 text-neutral-400"
                  }`}>
                    {d.is_active ? "Diizinkan" : "Diblokir"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(d)}
                    className="p-2 text-neutral-400 hover:text-forest rounded-lg hover:bg-neutral-100 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(d.id, tab)}
                    className="p-2 text-neutral-400 hover:text-danger rounded-lg hover:bg-neutral-100 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showManager && (
        <DiscountManager
          discount={editingDiscount}
          scope={tab}
          onSave={handleSave}
          onClose={() => {
            setShowManager(false);
            setEditingDiscount(null);
          }}
          onSuccess={() => {
            setShowManager(false);
            setEditingDiscount(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
