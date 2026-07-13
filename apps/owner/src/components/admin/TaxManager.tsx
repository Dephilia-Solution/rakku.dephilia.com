"use client";

import { useState, useEffect } from "react";
import { Tax } from "@rakku/shared-types";
import { showToast } from "@rakku/ui";
import { X } from "lucide-react";
import { useModalHistory } from "@/hooks/useModalHistory";

interface TaxManagerProps {
  isOpen: boolean;
  tax: Tax | null;
  onSave: (data: { name: string; type: "percentage" | "fixed"; value: number; sort_order: number }) => Promise<void>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TaxManager({ isOpen, tax, onSave, onClose, onSuccess }: TaxManagerProps) {
  const [name, setName] = useState(tax?.name ?? "");
  const [type, setType] = useState<"percentage" | "fixed">(tax?.type ?? "percentage");
  const [value, setValue] = useState(tax?.value ?? 0);
  const [sortOrder, setSortOrder] = useState(tax?.sort_order ?? 0);
  const [saving, setSaving] = useState(false);
  const { handleCloseAndPop } = useModalHistory(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setName(tax?.name ?? "");
      setType(tax?.type ?? "percentage");
      setValue(tax?.value ?? 0);
      setSortOrder(tax?.sort_order ?? 0);
      setSaving(false);
    }
  }, [isOpen, tax]);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm overflow-y-auto overscroll-contain" onClick={handleCloseAndPop}>
      <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
        <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-md w-full sm:max-w-md mobile-slide-up pb-safe sm:pb-0 max-h-[90dvh] sm:max-h-none overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-neutral-300" />
          </div>

          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-200">
            <h3 className="font-display font-semibold text-base text-neutral-900">
              {tax ? "Edit Tax" : "Tambah Tax"}
            </h3>
            <button onClick={handleCloseAndPop} className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
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
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-neutral-200 bg-white flex gap-2">
            <button
              onClick={handleCloseAndPop}
              className="flex-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl py-3 hover:bg-neutral-200 transition-colors active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 bg-forest text-white rounded-xl py-3 text-sm font-semibold hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
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
  );
}
