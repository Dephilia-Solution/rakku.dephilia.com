"use client";

import { useState, useEffect, useCallback } from "react";
import { PricingTier } from "@rakku/shared-types";
import { showToast } from "@rakku/ui";
import PricingTierManager from "@/components/admin/PricingTierManager";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, Layers, ChevronLeft, ChevronRight, Building2 } from "lucide-react";

interface OutletOption {
  id: string;
  name: string;
}

interface PricingTierWithOutlet extends PricingTier {
  outlet_name: string;
}

interface Props {
  outlets: OutletOption[];
}

export default function PricingTiersClient({ outlets }: Props) {
  const [outletId, setOutletId] = useState<string>("");
  const [tiers, setTiers] = useState<PricingTierWithOutlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManager, setShowManager] = useState(false);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const canEdit = outletId !== "";

  const fetchTiers = useCallback(async () => {
    setLoading(true);
    try {
      const url = outletId
        ? `/api/owner/pricing-tiers?outlet_id=${encodeURIComponent(outletId)}`
        : "/api/owner/pricing-tiers";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTiers(data.tiers ?? []);
      }
    } catch {
      showToast("error", "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  const handleAdd = () => {
    setEditingTier(null);
    setShowManager(true);
  };

  const handleEdit = (tier: PricingTier) => {
    setEditingTier(tier);
    setShowManager(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/owner/pricing-tiers/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Tier berhasil dihapus");
        fetchTiers();
      } else {
        const data = await res.json();
        showToast("error", data.error ?? "Gagal menghapus");
      }
    } catch {
      showToast("error", "Gagal menghapus");
    }
  };

  const handleSave = async (data: { name: string; slug: string; sort_order: number }) => {
    if (editingTier) {
      const res = await fetch(`/api/owner/pricing-tiers/${editingTier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Gagal update");
      }
    } else {
      const res = await fetch("/api/owner/pricing-tiers", {
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

  const totalPages = Math.max(1, Math.ceil(tiers.length / perPage));
  const paginated = tiers.slice((page - 1) * perPage, page * perPage);

  const handlePerPage = (val: number) => {
    setPerPage(val);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Pricing Tiers</h1>
          <p className="text-sm text-neutral-400 mt-1">
            {canEdit
              ? `Kelola tier harga untuk ${outlets.find((o) => o.id === outletId)?.name ?? "outlet ini"}`
              : "Pilih outlet spesifik untuk mengelola tier"}
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

      {loading ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-sm text-neutral-400">
          Memuat data...
        </div>
      ) : tiers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Layers size={28} className="text-neutral-400" />
          </div>
          <p className="text-sm text-neutral-400">
            Belum ada pricing tier{!canEdit ? " di outlet mana pun" : ""}.
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
                  <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Slug</th>
                  {!canEdit && (
                    <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Outlet</th>
                  )}
                  <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Urutan</th>
                  {canEdit && (
                    <th className="text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paginated.map((tier) => (
                  <tr key={tier.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-3 text-sm font-semibold text-neutral-900">{tier.name}</td>
                    <td className="px-6 py-3 text-xs text-neutral-400 font-mono">{tier.slug}</td>
                    {!canEdit && (
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
                          <Building2 size={12} className="text-neutral-400" />
                          {tier.outlet_name || "-"}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        tier.is_active
                          ? "bg-success/10 text-success"
                          : "bg-neutral-100 text-neutral-400"
                      }`}>
                        {tier.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-neutral-600">{tier.sort_order}</td>
                    {canEdit && (
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(tier)}
                            className="p-2 text-neutral-400 hover:text-forest rounded-lg hover:bg-neutral-100 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setPendingDeleteId(tier.id)}
                            className="p-2 text-neutral-400 hover:text-danger rounded-lg hover:bg-neutral-100 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-neutral-100">
            {paginated.map((tier) => (
              <div key={tier.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{tier.name}</p>
                    <p className="text-xs text-neutral-400 font-mono">{tier.slug}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    tier.is_active
                      ? "bg-success/10 text-success"
                      : "bg-neutral-100 text-neutral-400"
                  }`}>
                    {tier.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                {!canEdit && (
                  <p className="text-xs text-neutral-400 inline-flex items-center gap-1 mb-2">
                    <Building2 size={11} />
                    {tier.outlet_name || "-"}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">Urutan: {tier.sort_order}</span>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(tier)}
                        className="p-2 text-neutral-400 hover:text-forest rounded-lg hover:bg-neutral-100 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(tier.id)}
                        className="p-2 text-neutral-400 hover:text-danger rounded-lg hover:bg-neutral-100 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {tiers.length > 0 && (
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
                <span>of {tiers.length} tiers</span>
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

      <PricingTierManager
        isOpen={showManager}
        tier={editingTier}
        onSave={handleSave}
        onClose={() => {
          setShowManager(false);
          setEditingTier(null);
        }}
        onSuccess={() => {
          setShowManager(false);
          setEditingTier(null);
          fetchTiers();
        }}
      />

      <ConfirmDialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) handleDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        title="Hapus Pricing Tier"
        message="Apakah kamu yakin ingin menghapus pricing tier ini? Tindakan ini tidak dapat dibatalkan."
      />
    </div>
  );
}
