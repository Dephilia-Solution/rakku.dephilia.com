"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IngredientUnit } from "@rakku/shared-types";
import {
  PageHeader,
  FormField,
  fieldInputClass,
  fieldSelectClass,
  Toggle,
  showToast,
} from "@rakku/ui";
import { createIngredient, updateIngredient } from "@/lib/supabase/queries.client";
import { useNavMode } from "@/hooks/useNavMode";
import { ArrowLeft, Check, Boxes, Info } from "lucide-react";

const UNIT_OPTIONS: { value: IngredientUnit; label: string }[] = [
  { value: "gram", label: "gram" },
  { value: "ml", label: "ml" },
  { value: "pcs", label: "pcs" },
  { value: "kg", label: "kg" },
  { value: "liter", label: "liter" },
];

interface IngredientFormProps {
  mode: "add" | "edit";
  ingredientId?: string;
  initialIngredient?: {
    name: string;
    unit: IngredientUnit;
    stock_quantity: number;
    min_stock_alert: number;
    cost_per_unit: number;
    is_active: boolean;
  };
}

export default function IngredientForm({
  mode,
  ingredientId,
  initialIngredient,
}: IngredientFormProps) {
  const router = useRouter();
  const navMode = useNavMode();
  const isMobileBottom = navMode === "bottom";

  const [name, setName] = useState(initialIngredient?.name ?? "");
  const [unit, setUnit] = useState<IngredientUnit>(initialIngredient?.unit ?? "gram");
  const [stockQuantity, setStockQuantity] = useState(
    initialIngredient ? String(initialIngredient.stock_quantity) : ""
  );
  const [minStockAlert, setMinStockAlert] = useState(
    initialIngredient ? String(initialIngredient.min_stock_alert) : ""
  );
  const [costPerUnit, setCostPerUnit] = useState(
    initialIngredient ? String(initialIngredient.cost_per_unit) : ""
  );
  const [isActive, setIsActive] = useState(initialIngredient?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast("error", "Nama bahan baku harus diisi");
      return;
    }
    setSaving(true);

    const payload = {
      name: name.trim(),
      unit,
      stock_quantity: Number(stockQuantity) || 0,
      min_stock_alert: Number(minStockAlert) || 0,
      cost_per_unit: Number(costPerUnit) || 0,
    };

    try {
      if (mode === "edit" && ingredientId) {
        await updateIngredient(ingredientId, { ...payload, is_active: isActive });
        showToast("success", "Bahan baku berhasil diupdate");
      } else {
        await createIngredient(payload);
        showToast("success", "Bahan baku berhasil ditambahkan");
      }
      router.push("/ingredients");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      showToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (extra = "") => (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving}
      className={`px-5 md:px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 ${extra}`}
    >
      <Check size={18} />
      {saving ? "Menyimpan..." : "Simpan Bahan"}
    </button>
  );

  return (
    <div
      className={`p-4 pb-24 md:p-6 max-w-3xl mx-auto ${
        isMobileBottom ? "pt-[calc(var(--safe-top)+6.5rem)]" : ""
      }`}
    >
      <div
        className={
          isMobileBottom
            ? "fixed top-0 pt-4 left-0 right-0 z-[55] px-4 pb-2 bg-background"
            : ""
        }
      >
        <PageHeader
          backAs={
            <Link
              href="/ingredients"
              aria-label="Kembali"
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
            >
              <ArrowLeft size={20} />
            </Link>
          }
          title={mode === "edit" ? "Edit Bahan Baku" : "Tambah Bahan Baku"}
          subtitle={
            mode === "edit"
              ? "Perbarui data stok dan harga beli bahan ini."
              : "Daftarkan bahan baku baru untuk resep produk Anda."
          }
          actions={
            isMobileBottom ? null : (
              <>
                <Link
                  href="/ingredients"
                  className="px-5 md:px-6 py-2.5 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-all"
                >
                  Batal
                </Link>
                {saveButton()}
              </>
            )
          }
        />
      </div>

      <div className="space-y-6">
        <div className="bg-surface-container-lowest rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-headline-sm text-on-surface flex items-center gap-2">
              <Boxes size={22} className="text-primary" />
              Informasi Bahan
            </h3>
            <Toggle
              checked={isActive}
              onChange={setIsActive}
              label={isActive ? "Aktif" : "Nonaktif"}
            />
          </div>

          <div className="space-y-4">
            <FormField label="Nama Bahan" htmlFor="ingredient-name" required>
              <input
                id="ingredient-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mis. Kopi Arabica, Susu UHT, Cup 12oz"
                className={fieldInputClass}
              />
            </FormField>

            <FormField label="Satuan" htmlFor="ingredient-unit" required>
              <select
                id="ingredient-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as IngredientUnit)}
                className={fieldSelectClass}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Stok Saat Ini"
                htmlFor="ingredient-stock"
                hint="Stok fisik yang tercatat di sistem"
              >
                <input
                  id="ingredient-stock"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  placeholder="0"
                  className={fieldInputClass}
                />
              </FormField>

              <FormField
                label="Batas Stok Minimum"
                htmlFor="ingredient-min-stock"
                hint="Peringatan muncul saat stok ≤ batas ini"
              >
                <input
                  id="ingredient-min-stock"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={minStockAlert}
                  onChange={(e) => setMinStockAlert(e.target.value)}
                  placeholder="0"
                  className={fieldInputClass}
                />
              </FormField>
            </div>

            <FormField
              label="Harga Beli per Satuan"
              htmlFor="ingredient-cost"
              hint="Dipakai untuk hitung HPP produk (metode last cost)"
            >
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">
                  Rp
                </span>
                <input
                  id="ingredient-cost"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(e.target.value)}
                  placeholder="0"
                  className={`${fieldInputClass} !pl-12`}
                />
              </div>
            </FormField>
          </div>
        </div>

        <div className="bg-surface-container-low/30 rounded-xl p-4 border border-surface-container">
          <p className="text-xs text-on-surface-variant flex items-center gap-2">
            <Info size={14} className="flex-shrink-0" />
            Setelah bahan terdaftar, hubungkan ke produk lewat tombol
            &quot;Kelola Resep&quot; di halaman tambah/edit produk.
          </p>
        </div>
      </div>

      {isMobileBottom && (
        <div
          className="fixed left-0 right-0 z-[55]"
          style={{ bottom: "var(--nav-bottom-safe)" }}
        >
          <div className="bg-surface-container-lowest/95 backdrop-blur-xl border-t border-surface-container px-4 py-3 flex gap-2">
            <Link
              href="/ingredients"
              className="flex-1 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant active:scale-[0.98] transition-all"
            >
              Batal
            </Link>
            {saveButton("flex-1 py-3 shadow-none")}
          </div>
        </div>
      )}
    </div>
  );
}
