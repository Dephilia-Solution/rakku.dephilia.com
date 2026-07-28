"use client";

import { useState, useEffect } from "react";
import {
  ProductDiscount,
  OrderDiscount,
  ProductWithCategory,
} from "@rakku/shared-types";
import {
  SlideOver,
  FormField,
  fieldInputClass,
  fieldSelectClass,
  showToast,
} from "@rakku/ui";

interface Props {
  open: boolean;
  onClose: () => void;
  outletId: string;
  discount: (ProductDiscount | OrderDiscount) | null;
  scope: "product" | "order";
  onSuccess: () => void;
}

export default function DiscountFormSlideOver({
  open,
  onClose,
  outletId,
  discount,
  scope,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState(0);
  const [productId, setProductId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (open) {
      setName(discount?.name ?? "");
      setType((discount as ProductDiscount)?.type ?? "percentage");
      setValue((discount as ProductDiscount)?.value ?? 0);
      setProductId((discount as ProductDiscount)?.product_id ?? "");
      setStartDate(discount?.start_date?.slice(0, 16) ?? "");
      setEndDate(discount?.end_date?.slice(0, 16) ?? "");
      setSaving(false);
    }
  }, [open, discount]);

  useEffect(() => {
    if (open && scope === "product" && outletId) {
      setLoadingProducts(true);
      fetch(`/api/owner/products?outlet_id=${encodeURIComponent(outletId)}`)
        .then((res) => (res.ok ? res.json() : { products: [] }))
        .then((data) => setProducts(data.products ?? []))
        .catch(() => {})
        .finally(() => setLoadingProducts(false));
    }
  }, [open, scope, outletId]);

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
      const payload = {
        scope,
        product_id: scope === "product" ? productId : undefined,
        name: name.trim(),
        type,
        value,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
      };
      const res = discount
        ? await fetch(`/api/owner/discounts/${discount.id}?scope=${scope}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/owner/discounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outlet_id: outletId, ...payload }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Gagal menyimpan diskon");
      }
      showToast(
        "success",
        discount ? "Diskon berhasil diperbarui" : "Diskon berhasil ditambahkan"
      );
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan diskon";
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={discount ? "Edit Diskon" : "Tambah Diskon"}
      subtitle={
        scope === "product"
          ? "Diskon untuk satu produk tertentu"
          : "Diskon untuk seluruh pesanan"
      }
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-surface-container text-on-surface-variant font-semibold rounded-xl hover:bg-surface-container-high transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-3 bg-primary text-on-primary font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Nama Diskon" htmlFor="discount-name" required>
          <input
            id="discount-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Promo Lebaran"
            className={fieldInputClass}
          />
        </FormField>

        <FormField label="Tipe Diskon" required>
          <div className="flex gap-2">
            {(
              [
                { key: "percentage", label: "Persentase (%)" },
                { key: "fixed", label: "Nominal (Rp)" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setType(opt.key)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  type === opt.key
                    ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FormField>

        <FormField
          label={type === "percentage" ? "Persentase (%)" : "Nilai (Rp)"}
          htmlFor="discount-value"
          required
        >
          <input
            id="discount-value"
            type="number"
            min={0}
            value={value || ""}
            onChange={(e) => setValue(Number(e.target.value) || 0)}
            placeholder={type === "percentage" ? "Contoh: 20" : "Contoh: 10000"}
            className={fieldInputClass}
          />
        </FormField>

        {scope === "product" && (
          <FormField label="Produk" htmlFor="discount-product" required>
            <select
              id="discount-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={fieldSelectClass}
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
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Mulai" htmlFor="discount-start" required>
            <input
              id="discount-start"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={fieldInputClass}
            />
          </FormField>
          <FormField label="Berakhir" htmlFor="discount-end" required>
            <input
              id="discount-end"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={fieldInputClass}
            />
          </FormField>
        </div>
      </div>
    </SlideOver>
  );
}
