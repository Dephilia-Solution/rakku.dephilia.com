"use client";

import { useState, useEffect, useCallback } from "react";
import { PricingTier } from "@rakku/shared-types";
import { showToast } from "@rakku/ui";
import PricingTierManager from "@/components/admin/PricingTierManager";
import { Plus, Pencil, Trash2, DollarSign } from "lucide-react";

export default function PricingTiersPage() {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManager, setShowManager] = useState(false);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);

  const fetchTiers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pricing-tiers");
      if (res.ok) {
        const data = await res.json();
        setTiers(data.tiers ?? []);
      }
    } catch {
      showToast("error", "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (!confirm("Hapus pricing tier ini?")) return;
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
          Tambah Tier
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-neutral-400 text-sm">Memuat...</div>
      ) : tiers.length === 0 ? (
        <div className="text-center py-12 text-neutral-400 text-sm border border-dashed border-neutral-200 rounded-xl">
          <DollarSign size={32} className="mx-auto mb-2 opacity-50" />
          Belum ada pricing tier. Klik &quot;Tambah Tier&quot; untuk memulai.
        </div>
      ) : (
        <div className="space-y-2">
          {tiers.map((tier) => (
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
                  onClick={() => handleDelete(tier.id)}
                  className="p-2 text-neutral-400 hover:text-danger rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showManager && (
        <PricingTierManager
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
      )}
    </div>
  );
}
