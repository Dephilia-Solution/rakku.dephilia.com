"use client";

import { useState, useEffect, useCallback } from "react";
import { ProductDiscount, OrderDiscount, ProductWithCategory } from "@rakku/shared-types";
import { showToast } from "@rakku/ui";
import DiscountManager from "@/components/admin/DiscountManager";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, Percent, ChevronLeft, ChevronRight, Building2 } from "lucide-react";

type TabType = "product" | "order";

interface OutletOption {
  id: string;
  name: string;
}

interface ProductDiscountWithOutlet extends ProductDiscount {
  outlet_name: string;
}

interface OrderDiscountWithOutlet extends OrderDiscount {
  outlet_name: string;
}

interface Props {
  outlets: OutletOption[];
}

export default function DiscountsClient({ outlets }: Props) {
  const [tab, setTab] = useState<TabType>("product");
  const [outletId, setOutletId] = useState<string>("");
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscountWithOutlet[]>([]);
  const [orderDiscounts, setOrderDiscounts] = useState<OrderDiscountWithOutlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManager, setShowManager] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<(ProductDiscount | OrderDiscount) | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; scope: "product" | "order" } | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const canEdit = outletId !== "";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = outletId
        ? `/api/owner/discounts?outlet_id=${encodeURIComponent(outletId)}`
        : "/api/owner/discounts";
      const res = await fetch(url);
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
  }, [outletId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchProducts = useCallback(async (): Promise<ProductWithCategory[]> => {
    if (!outletId) return [];
    try {
      const res = await fetch(`/api/owner/products?outlet_id=${encodeURIComponent(outletId)}`);
      if (res.ok) {
        const data = await res.json();
        return data.products ?? [];
      }
    } catch {
      // ignore
    }
    return [];
  }, [outletId]);

  const handleAdd = () => {
    setEditingDiscount(null);
    setShowManager(true);
  };

  const handleEdit = (discount: ProductDiscount | OrderDiscount) => {
    setEditingDiscount(discount);
    setShowManager(true);
  };

  const handleDelete = async (id: string, scope: "product" | "order") => {
    try {
      const res = await fetch(`/api/owner/discounts/${id}?scope=${scope}`, { method: "DELETE" });
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
      const res = await fetch(`/api/owner/discounts/${editingDiscount.id}?scope=${data.scope}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Gagal update");
      }
    } else {
      const res = await fetch("/api/owner/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlet_id: outletId, ...data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Gagal tambah");
      }
    }
  };

  const now = new Date();
  const isActive = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    return now >= s && now <= e;
  };

  const discounts = tab === "product" ? productDiscounts : orderDiscounts;

  const totalPages = Math.max(1, Math.ceil(discounts.length / perPage));
  const paginated = discounts.slice((page - 1) * perPage, page * perPage);

  const handleTab = (t: TabType) => {
    setTab(t);
    setPage(1);
  };

  const handlePerPage = (val: number) => {
    setPerPage(val);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Kelola Diskon</h1>
          <p className="text-sm text-neutral-400 mt-1">
            {canEdit
              ? `Atur diskon untuk ${outlets.find((o) => o.id === outletId)?.name ?? "outlet ini"}`
              : "Pilih outlet spesifik untuk mengelola diskon"}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          {canEdit && (
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-forest text-white text-sm font-semibold rounded-xl hover:bg-forest-dark transition-all"
            >
              <Plus size={16} />
              Tambah
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => handleTab("product")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === "product"
              ? "bg-forest text-white shadow-sm"
              : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          Diskon Produk
        </button>
        <button
          onClick={() => handleTab("order")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === "order"
              ? "bg-forest text-white shadow-sm"
              : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          Diskon Pesanan
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-sm text-neutral-400">
          Memuat data...
        </div>
      ) : discounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Percent size={28} className="text-neutral-400" />
          </div>
          <p className="text-sm text-neutral-400">
            Belum ada {tab === "product" ? "diskon produk" : "diskon pesanan"}.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Nama</th>
                  <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Nilai</th>
                  <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Periode</th>
                  {!canEdit && (
                    <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Outlet</th>
                  )}
                  <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Status</th>
                  {canEdit && (
                    <th className="text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paginated.map((discount) => {
                  const d = discount as ProductDiscountWithOutlet & OrderDiscountWithOutlet;
                  const active = isActive(d.start_date, d.end_date);
                  return (
                    <tr key={d.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-3">
                        <div className="text-sm font-semibold text-neutral-900">{d.name}</div>
                        {tab === "product" && (d as ProductDiscountWithOutlet).product_id && (
                          <div className="text-[10px] text-neutral-400 mt-0.5">
                            Produk: {(d as ProductDiscountWithOutlet).product_id.slice(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 text-xs text-neutral-400 font-mono">
                        {d.type === "percentage" ? `${d.value}%` : `Rp ${d.value.toLocaleString("id-ID")}`}
                      </td>
                      <td className="px-6 py-3 text-[10px] text-neutral-400">
                        {new Date(d.start_date).toLocaleDateString("id-ID")} — {new Date(d.end_date).toLocaleDateString("id-ID")}
                      </td>
                      {!canEdit && (
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
                            <Building2 size={12} className="text-neutral-400" />
                            {d.outlet_name || "-"}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5">
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
                      </td>
                      {canEdit && (
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEdit(d)}
                              className="p-2 text-neutral-400 hover:text-forest rounded-lg hover:bg-neutral-100 transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setPendingDelete({ id: d.id, scope: tab })}
                              className="p-2 text-neutral-400 hover:text-danger rounded-lg hover:bg-neutral-100 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-neutral-100">
            {paginated.map((discount) => {
              const d = discount as ProductDiscountWithOutlet & OrderDiscountWithOutlet;
              const active = isActive(d.start_date, d.end_date);
              return (
                <div key={d.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{d.name}</p>
                      <p className="text-xs text-neutral-400 font-mono">
                        {d.type === "percentage" ? `${d.value}%` : `Rp ${d.value.toLocaleString("id-ID")}`}
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        {new Date(d.start_date).toLocaleDateString("id-ID")} — {new Date(d.end_date).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      active
                        ? "bg-success/10 text-success"
                        : "bg-neutral-100 text-neutral-400"
                    }`}>
                      {active ? "Aktif" : "Kadaluarsa"}
                    </span>
                  </div>
                  {!canEdit && (
                    <p className="text-xs text-neutral-400 inline-flex items-center gap-1 mb-2">
                      <Building2 size={11} />
                      {d.outlet_name || "-"}
                    </p>
                  )}
                  {canEdit && (
                    <div className="flex items-center justify-end gap-1 mt-2">
                      <button
                        onClick={() => handleEdit(d)}
                        className="p-2 text-neutral-400 hover:text-forest rounded-lg hover:bg-neutral-100 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setPendingDelete({ id: d.id, scope: tab })}
                        className="p-2 text-neutral-400 hover:text-danger rounded-lg hover:bg-neutral-100 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {discounts.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-neutral-100">
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <span>Show</span>
                <select
                  value={perPage}
                  onChange={(e) => handlePerPage(Number(e.target.value))}
                  className="bg-white border border-neutral-200 rounded-lg px-2 py-1 text-sm text-neutral-900 focus:outline-none focus:border-forest"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span>of {discounts.length} discounts</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg text-neutral-400 hover:text-forest hover:bg-forest/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-neutral-300">...</span>
                      )}
                      <button
                        onClick={() => setPage(p)}
                        className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                          page === p
                            ? "bg-forest text-white"
                            : "text-neutral-600 hover:bg-neutral-100"
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg text-neutral-400 hover:text-forest hover:bg-forest/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <DiscountManager
        isOpen={showManager}
        discount={editingDiscount}
        scope={tab}
        fetchProducts={fetchProducts}
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

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) handleDelete(pendingDelete.id, pendingDelete.scope);
          setPendingDelete(null);
        }}
        title="Hapus Diskon"
        message="Apakah kamu yakin ingin menghapus diskon ini? Tindakan ini tidak dapat dibatalkan."
      />
    </div>
  );
}
