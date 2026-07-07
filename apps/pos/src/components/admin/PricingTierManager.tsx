"use client";

import { useState } from "react";
import { PricingTier } from "@rakku/shared-types";
import { showToast } from "@rakku/ui";
import { X } from "lucide-react";

interface PricingTierManagerProps {
  tier: PricingTier | null;
  onSave: (data: { name: string; slug: string; sort_order: number }) => Promise<void>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PricingTierManager({ tier, onSave, onClose, onSuccess }: PricingTierManagerProps) {
  const [name, setName] = useState(tier?.name ?? "");
  const [slug, setSlug] = useState(tier?.slug ?? "");
  const [sortOrder, setSortOrder] = useState(tier?.sort_order ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSlugChange = (value: string) => {
    setSlug(value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast("error", "Nama tier wajib diisi");
      return;
    }
    if (!slug.trim()) {
      showToast("error", "Slug tier wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), slug: slug.trim(), sort_order: sortOrder });
      showToast("success", tier ? "Tier berhasil diperbarui" : "Tier berhasil ditambahkan");
      onSuccess();
    } catch {
      showToast("error", "Gagal menyimpan tier");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-semibold text-lg text-neutral-900">
              {tier ? "Edit Pricing Tier" : "Tambah Pricing Tier"}
            </h3>
            <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block">
                Nama Tier
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Dine In"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block">
                Slug
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="Contoh: dine_in"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
              <p className="text-[10px] text-neutral-400 mt-1">
                Slug akan otomatis diubah ke format URL-friendly
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block">
                Urutan
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                className="w-24 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 bg-neutral-100 text-neutral-700 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-neutral-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 bg-forest text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Simpan"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
