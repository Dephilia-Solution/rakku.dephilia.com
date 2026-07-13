"use client";

import { useState, useEffect } from "react";
import { ProductDiscount, OrderDiscount, ProductWithCategory } from "@rakku/shared-types";
import { showToast } from "@rakku/ui";
import { X } from "lucide-react";
import { useModalHistory } from "@/hooks/useModalHistory";

interface DiscountManagerProps {
  isOpen: boolean;
  discount: (ProductDiscount | OrderDiscount) | null;
  scope: "product" | "order";
  fetchProducts: () => Promise<ProductWithCategory[]>;
  onSave: (data: {
    scope: "product" | "order";
    product_id?: string;
    name: string;
    type: "percentage" | "fixed";
    value: number;
    start_date: string;
    end_date: string;
  }) => Promise<void>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DiscountManager({ isOpen, discount, scope, fetchProducts, onSave, onClose, onSuccess }: DiscountManagerProps) {
  const [name, setName] = useState(discount?.name ?? "");
  const [type, setType] = useState<"percentage" | "fixed">((discount as ProductDiscount)?.type ?? "percentage");
  const [value, setValue] = useState((discount as ProductDiscount)?.value ?? 0);
  const [productId, setProductId] = useState((discount as ProductDiscount)?.product_id ?? "");
  const [startDate, setStartDate] = useState(discount?.start_date?.slice(0, 16) ?? "");
  const [endDate, setEndDate] = useState(discount?.end_date?.slice(0, 16) ?? "");
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const { handleCloseAndPop } = useModalHistory(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setName(discount?.name ?? "");
      setType((discount as ProductDiscount)?.type ?? "percentage");
      setValue((discount as ProductDiscount)?.value ?? 0);
      setProductId((discount as ProductDiscount)?.product_id ?? "");
      setStartDate(discount?.start_date?.slice(0, 16) ?? "");
      setEndDate(discount?.end_date?.slice(0, 16) ?? "");
      setSaving(false);
    }
  }, [isOpen, discount]);

  useEffect(() => {
    if (isOpen && scope === "product") {
      setLoadingProducts(true);
      fetchProducts()
        .then(setProducts)
        .catch(() => setProducts([]))
        .finally(() => setLoadingProducts(false));
    }
  }, [isOpen, scope, fetchProducts]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast("error", "Nama diskon wajib diisi");
      return;
    }
    if (value <= 0) {
      showToast("error", "Nilai diskon harus lebih dari 0");
      return;
    }
    if (!startDate || !endDate) {
      showToast("error", "Periode diskon wajib diisi");
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      showToast("error", "Tanggal akhir harus setelah tanggal mulai");
      return;
    }
    if (scope === "product" && !productId) {
      showToast("error", "Produk wajib dipilih");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        scope,
        product_id: scope === "product" ? productId : undefined,
        name: name.trim(),
        type,
        value,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
      });
      showToast("success", discount ? "Diskon berhasil diperbarui" : "Diskon berhasil ditambahkan");
      onSuccess();
    } catch {
      showToast("error", "Gagal menyimpan diskon");
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
              {discount ? "Edit Diskon" : "Tambah Diskon"}
            </h3>
            <button onClick={handleCloseAndPop} className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block">
                Nama Diskon
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Promo Lebaran"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block">
                Tipe Diskon
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
                placeholder={type === "percentage" ? "Contoh: 20" : "Contoh: 10000"}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
            </div>

            {scope === "product" && (
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block">
                  Produk
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                >
                  <option value="">Pilih produk...</option>
                  {loadingProducts ? (
                    <option disabled>Memuat...</option>
                  ) : (
                    products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block">
                  Tanggal Mulai
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 block">
                  Tanggal Berakhir
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                />
              </div>
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
