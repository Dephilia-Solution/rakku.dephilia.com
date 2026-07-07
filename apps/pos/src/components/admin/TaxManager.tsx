"use client";

import { useState } from "react";
import { Tax } from "@rakku/shared-types";
import { showToast } from "@rakku/ui";
import { X } from "lucide-react";

interface TaxManagerProps {
  tax: Tax | null;
  onSave: (data: { name: string; type: "percentage" | "fixed"; value: number; sort_order: number }) => Promise<void>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TaxManager({ tax, onSave, onClose, onSuccess }: TaxManagerProps) {
  const [name, setName] = useState(tax?.name ?? "");
  const [type, setType] = useState<"percentage" | "fixed">(tax?.type ?? "percentage");
  const [value, setValue] = useState(tax?.value ?? 0);
  const [sortOrder, setSortOrder] = useState(tax?.sort_order ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast("error", "Nama tax wajib diisi");
      return;
    }
    if (value <= 0) {
      showToast("error", "Nilai tax harus lebih dari 0");
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), type, value, sort_order: sortOrder });
      showToast("success", tax ? "Tax berhasil diperbarui" : "Tax berhasil ditambahkan");
      onSuccess();
    } catch {
      showToast("error", "Gagal menyimpan tax");
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
              {tax ? "Edit Tax" : "Tambah Tax"}
            </h3>
            <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block">
                Nama Tax
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: PPN, Service Tax"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block">
                Tipe
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setType("percentage")}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    type === "percentage"
                      ? "border-forest bg-primary-50 text-forest"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  Persentase (%)
                </button>
                <button
                  onClick={() => setType("fixed")}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    type === "fixed"
                      ? "border-forest bg-primary-50 text-forest"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  Nominal (Rp)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block">
                {type === "percentage" ? "Persentase (%)" : "Nilai (Rp)"}
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(Number(e.target.value) || 0)}
                placeholder={type === "percentage" ? "Contoh: 10" : "Contoh: 5000"}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
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
