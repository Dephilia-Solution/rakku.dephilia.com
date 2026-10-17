"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Ingredient, IngredientUnit } from "@rakku/shared-types";
import { SlideOver, fieldInputClass, fieldSelectClass } from "@rakku/ui";
import { useMerchantRequest, useMerchantRuntime, useMerchantToast } from "@/lib/merchant-runtime";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Trash2, Plus, Loader2 } from "lucide-react";

// Baris resep di UI — baris yang sudah tersimpan di DB punya `id`,
// baris antrian (mode tambah produk) belum punya `id`.
export interface RecipeRow {
  id?: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: IngredientUnit;
  quantity_used: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  outletId: string;
  productId?: string; // ada = mode edit (persist langsung), kosong = mode tambah (antrian lokal)
  rows: RecipeRow[];
  onRowsChange?: (rows: RecipeRow[]) => void;
}

export default function RecipeManagerSlideOver({
  open,
  onClose,
  outletId,
  productId,
  rows,
  onRowsChange,
}: Props) {
  const request = useMerchantRequest();
  const showToast = useMerchantToast();
  const isActive = useMerchantRuntime()?.active;
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RecipeRow | null>(null);

  const onRowsChangeRef = useRef(onRowsChange);
  useEffect(() => { onRowsChangeRef.current = onRowsChange; }, [onRowsChange]);

  const applyRows = useCallback((next: RecipeRow[]) => {
    onRowsChangeRef.current?.(next);
  }, []);

  const fetchIngredients = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted || isActive?.() === false) return;
    try {
      const res = await request(`/api/owner/ingredients?outlet_id=${encodeURIComponent(outletId)}`, { signal });
      if (res.ok) {
        const data = await res.json();
        if (signal?.aborted || isActive?.() === false) return;
        setIngredients(
          (data as Ingredient[]).filter((i) => i.is_active)
        );
      }
    } catch {
      if (signal?.aborted || isActive?.() === false) return;
      showToast("error", "Gagal memuat data bahan baku");
    }
  }, [outletId, request, showToast, isActive]);

  const fetchRecipes = useCallback(async (signal?: AbortSignal) => {
    if (!productId || signal?.aborted || isActive?.() === false) return;
    setLoading(true);
    try {
      const res = await request(`/api/owner/recipes?product_id=${productId}`, { signal });
      if (res.ok) {
        const data = await res.json();
        if (signal?.aborted || isActive?.() === false) return;
        applyRows(
          (data as Record<string, unknown>[]).map((r) => ({
            id: r.id as string,
            ingredient_id: r.ingredient_id as string,
            quantity_used: Number(r.quantity_used),
            ingredient_name:
              ((r.ingredients as Record<string, unknown>)?.name as string) ?? "",
            ingredient_unit:
              ((r.ingredients as Record<string, unknown>)?.unit as IngredientUnit) ??
              "pcs",
          }))
        );
      }
    } catch {
      if (signal?.aborted || isActive?.() === false) return;
      showToast("error", "Gagal memuat resep");
    } finally {
      if (!signal?.aborted && isActive?.() !== false) setLoading(false);
    }
  }, [productId, applyRows, request, showToast, isActive]);

  useEffect(() => {
    const controller = new AbortController();
    if (open) {
      void fetchIngredients(controller.signal);
      void fetchRecipes(controller.signal);
      setSelectedIngredientId("");
      setQuantity("");
    }
    return () => controller.abort();
  }, [open, fetchIngredients, fetchRecipes]);

  // Bahan yang sudah dipakai di resep tidak bisa dipilih lagi (UNIQUE constraint)
  const availableIngredients = ingredients.filter(
    (i) => !rows.some((r) => r.ingredient_id === i.id)
  );

  const selectedIngredient = ingredients.find((i) => i.id === selectedIngredientId);

  const handleAdd = async () => {
    if (isActive?.() === false) return;
    const qty = Number(quantity);
    if (!selectedIngredientId || !qty || qty <= 0 || saving) return;
    setSaving(true);

    // Mode tambah produk: antrekan lokal, di-flush setelah produk tersimpan
    if (!productId) {
      applyRows([
        ...rows,
        {
          ingredient_id: selectedIngredientId,
          ingredient_name: selectedIngredient?.name ?? "",
          ingredient_unit: selectedIngredient?.unit ?? "pcs",
          quantity_used: qty,
        },
      ]);
      setSelectedIngredientId("");
      setQuantity("");
      setSaving(false);
      return;
    }

    try {
      const res = await request("/api/owner/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          ingredient_id: selectedIngredientId,
          quantity_used: qty,
        }),
      });
      if (isActive?.() === false) return;
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Gagal menambah bahan resep");
      }
      setSelectedIngredientId("");
      setQuantity("");
      showToast("success", "Bahan resep berhasil ditambahkan");
      await fetchRecipes();
    } catch (err) {
      if (isActive?.() === false) return;
      const msg = err instanceof Error ? err.message : "Gagal menambah bahan resep";
      showToast("error", msg);
    } finally {
      if (isActive?.() !== false) setSaving(false);
    }
  };

  const handleDelete = async (row: RecipeRow) => {
    if (isActive?.() === false) return;
    // Mode tambah produk: hapus dari antrian lokal
    if (!row.id) {
      applyRows(rows.filter((r) => r.ingredient_id !== row.ingredient_id));
      return;
    }
    try {
      const res = await request(`/api/owner/recipes?id=${row.id}`, {
        method: "DELETE",
      });
      if (isActive?.() === false) return;
      if (res.ok) {
        showToast("success", "Bahan resep berhasil dihapus");
        await fetchRecipes();
      } else {
        const data = await res.json();
        if (isActive?.() === false) return;
        showToast("error", data.error ?? "Gagal menghapus");
      }
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Gagal menghapus");
    }
  };

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title="Kelola Resep"
        subtitle="Bahan yang terpakai per 1 porsi produk ini"
        footer={
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-surface-container text-on-surface font-semibold rounded-xl hover:bg-surface-container-high transition-colors"
          >
            Selesai
          </button>
        }
      >
        {/* Form tambah bahan */}
        <div className="space-y-2 mb-5">
          <select
            value={selectedIngredientId}
            onChange={(e) => setSelectedIngredientId(e.target.value)}
            className={fieldSelectClass}
          >
            <option value="">
              {availableIngredients.length === 0
                ? "Semua bahan sudah dipakai / belum ada bahan"
                : "Pilih bahan baku..."}
            </option>
            {availableIngredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={`Jumlah${selectedIngredient ? ` (${selectedIngredient.unit})` : ""}`}
              className={`flex-1 ${fieldInputClass}`}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !selectedIngredientId || !quantity}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus size={16} />
              Tambah
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-on-surface-variant">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {rows.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center py-8">
                Belum ada bahan di resep produk ini
              </p>
            )}
            {rows.map((row) => (
              <div
                key={row.id ?? row.ingredient_id}
                className="flex items-center justify-between gap-2 p-3.5 bg-surface-container-low rounded-xl"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {row.ingredient_name}
                    {!row.id && (
                      <span className="ml-2 text-[10px] font-bold uppercase text-warning">
                        Baru
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-on-surface-variant font-mono">
                    {row.quantity_used.toLocaleString("id-ID", { maximumFractionDigits: 2 })}{" "}
                    {row.ingredient_unit} / porsi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDelete(row)}
                  aria-label={`Hapus ${row.ingredient_name}`}
                  className="p-2 text-error hover:bg-error-container/20 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SlideOver>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) handleDelete(pendingDelete);
          setPendingDelete(null);
        }}
        title="Hapus Bahan Resep"
        message={`Hapus ${pendingDelete?.ingredient_name ?? "bahan ini"} dari resep produk?`}
      />
    </>
  );
}
