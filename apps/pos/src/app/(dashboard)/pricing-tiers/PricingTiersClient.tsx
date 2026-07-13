"use client";

import { useState } from "react";
import { PricingTier } from "@rakku/shared-types";
import { showToast } from "@rakku/ui";
import PricingTierManager from "@/components/admin/PricingTierManager";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, DollarSign, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  initialTiers: PricingTier[];
}

export default function PricingTiersClient({ initialTiers }: Props) {
  const [tiers, setTiers] = useState<PricingTier[]>(initialTiers);
  const [showManager, setShowManager] = useState(false);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const fetchTiers = async () => {
    try {
      const res = await fetch("/api/admin/pricing-tiers");
      if (res.ok) {
        const data = await res.json();
        setTiers(data.tiers ?? []);
      }
    } catch {
      showToast("error", "Gagal memuat data");
    }
  };

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
      const res = await fetch(`/api/admin/pricing-tiers?id=${id}`, { method: "DELETE" });
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
      const res = await fetch("/api/admin/pricing-tiers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTier.id, ...data }),
      });
      if (!res.ok) throw new Error("Gagal update");
    } else {
      const res = await fetch("/api/admin/pricing-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Gagal tambah");
    }
  };

  const totalPages = Math.ceil(tiers.length / perPage);
  const paginated = tiers.slice((page - 1) * perPage, page * perPage);

  const handlePerPage = (val: number) => {
    setPerPage(val);
    setPage(1);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold text-neutral-900">
            Pricing Tiers
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Kelola tier harga untuk setiap tipe pesanan
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 bg-forest text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-forest-dark transition-colors"
        >
          <Plus size={16} />
          Tambah
        </button>
      </div>

      {tiers.length === 0 ? (
        <div className="text-center py-12 text-neutral-400 text-sm border border-dashed border-neutral-200 rounded-xl">
          <DollarSign size={32} className="mx-auto mb-2 opacity-50" />
          Belum ada pricing tier. Klik &quot;Tambah Tier&quot; untuk memulai.
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((tier) => (
            <div
              key={tier.id}
              className="flex items-center justify-between bg-white rounded-xl border border-neutral-200 px-4 py-3 hover:border-neutral-300 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-neutral-900">
                    {tier.name}
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">
                    {tier.slug}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  tier.is_active
                    ? "bg-success/10 text-success"
                    : "bg-neutral-100 text-neutral-400"
                }`}>
                  {tier.is_active ? "Aktif" : "Nonaktif"}
                </span>
                <span className="text-xs text-neutral-400">
                  Urutan: {tier.sort_order}
                </span>
              </div>
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
            </div>
          ))}
        </div>
      )}

      {tiers.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-1">
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
