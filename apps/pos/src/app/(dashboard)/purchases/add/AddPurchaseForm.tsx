"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ingredient } from "@rakku/shared-types";
import { formatCurrency } from "@/lib/format";
import {
  showToast,
  PageHeader,
  FormField,
  fieldInputClass,
  fieldSelectClass,
} from "@rakku/ui";
import { createPurchase } from "@/lib/supabase/queries.client";
import {
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  ShoppingBag,
} from "lucide-react";

interface Props {
  ingredients: Ingredient[];
}

interface ItemRow {
  key: string;
  ingredient_id: string;
  quantity: string;
  unit_cost: string;
}

const EMPTY_ITEM: ItemRow = {
  key: "",
  ingredient_id: "",
  quantity: "",
  unit_cost: "",
};

function newRow(): ItemRow {
  return { ...EMPTY_ITEM, key: crypto.randomUUID() };
}

export default function AddPurchaseForm({ ingredients }: Props) {
  const router = useRouter();
  const [supplierName, setSupplierName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemRow[]>([newRow()]);
  const [saving, setSaving] = useState(false);

  const totalAmount = items.reduce((sum, i) => {
    const qty = Number(i.quantity) || 0;
    const cost = Number(i.unit_cost) || 0;
    return sum + qty * cost;
  }, 0);

  const updateItem = (key: string, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((i) => i.key !== key)));
  };

  const handleSubmit = async () => {
    const validItems = items.map((i) => ({
      ingredient_id: i.ingredient_id,
      quantity: Number(i.quantity),
      unit_cost: Number(i.unit_cost),
    }));

    const hasItems = validItems.some(
      (i) => i.ingredient_id && i.quantity > 0 && i.unit_cost >= 0
    );
    if (!hasItems) {
      showToast("error", "Minimal satu bahan dengan jumlah valid wajib diisi");
      return;
    }

    const payload = {
      supplier_name: supplierName.trim() || undefined,
      purchase_date: purchaseDate
        ? new Date(`${purchaseDate}T12:00:00`).toISOString()
        : undefined,
      note: note.trim() || undefined,
      items: validItems.filter((i) => i.ingredient_id),
    };

    setSaving(true);
    try {
      await createPurchase(payload);
      showToast("success", "Pembelian berhasil dicatat");
      router.push("/purchases");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      showToast("error", msg);
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <PageHeader
        backAs={
          <Link
            href="/purchases"
            aria-label="Kembali"
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <ArrowLeft size={20} />
          </Link>
        }
        title="Tambah Pembelian"
        subtitle="Stok dan harga beli (cost per unit) bahan otomatis ter-update."
      />

      <div className="bg-surface-container-lowest rounded-xl p-5 space-y-5">
        {/* Header info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Supplier" htmlFor="purchase-supplier">
            <input
              id="purchase-supplier"
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Nama supplier (opsional)"
              className={fieldInputClass}
            />
          </FormField>
          <FormField label="Tanggal" htmlFor="purchase-date">
            <input
              id="purchase-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className={fieldInputClass}
            />
          </FormField>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-on-surface">Bahan</p>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, newRow()])}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <Plus size={14} />
              Tambah Baris
            </button>
          </div>

          <div className="space-y-3">
            {items.map((row, idx) => (
              <div
                key={row.key}
                className="grid grid-cols-[1fr_90px_110px_36px] sm:grid-cols-[1fr_110px_130px_36px] gap-2 items-start"
              >
                <select
                  value={row.ingredient_id}
                  onChange={(e) =>
                    updateItem(row.key, {
                      ingredient_id: e.target.value,
                      unit_cost: e.target.value
                        ? String(
                            ingredients.find(
                              (ing) => ing.id === e.target.value
                            )?.cost_per_unit ?? ""
                          )
                        : row.unit_cost,
                    })
                  }
                  className={fieldSelectClass}
                  aria-label={`Bahan baris ${idx + 1}`}
                >
                  <option value="">Pilih bahan...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  placeholder="Jumlah"
                  value={row.quantity}
                  onChange={(e) => updateItem(row.key, { quantity: e.target.value })}
                  className={fieldInputClass}
                  aria-label={`Jumlah baris ${idx + 1}`}
                />
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  placeholder="Harga"
                  value={row.unit_cost}
                  onChange={(e) => updateItem(row.key, { unit_cost: e.target.value })}
                  className={fieldInputClass}
                  aria-label={`Harga baris ${idx + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeItem(row.key)}
                  aria-label={`Hapus baris ${idx + 1}`}
                  className="h-11 w-9 flex items-center justify-center rounded-lg text-error hover:bg-error-container/20 transition-colors disabled:opacity-40"
                  disabled={items.length === 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <FormField label="Catatan" htmlFor="purchase-note">
          <input
            id="purchase-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan pembelian (opsional)"
            className={fieldInputClass}
          />
        </FormField>

        {/* Total */}
        <div className="flex items-center justify-between pt-4 border-t border-surface-container">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ShoppingBag size={18} className="text-primary" />
            </div>
            <span className="text-sm font-semibold text-on-surface">Total</span>
          </div>
          <span className="font-mono text-lg font-bold text-on-surface">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <ArrowLeft size={18} />
          Batal
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <Check size={18} />
          {saving ? "Menyimpan..." : "Simpan Pembelian"}
        </button>
      </div>
    </div>
  );
}