"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Ingredient, IngredientUnit } from "@rakku/shared-types";
import SlideOver from "@/components/ui/OwnerSheet";
import { Pencil, Plus, Trash2, Loader2, Check, X } from "lucide-react";
import { useMerchantRequest, useMerchantRuntime } from "@/lib/merchant-runtime";
import IngredientFormSlideOver from "@/components/inventory/IngredientFormSlideOver";
import { inventoryInputClass, inventorySelectClass, parseInventoryDecimal } from "@/components/inventory/InventoryFormUI";

export interface RecipeRow {
  id?: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: IngredientUnit;
  quantity_used: number;
  cost_per_unit?: number;
}
interface Props {
  open: boolean; onClose: () => void; outletId: string; productId?: string;
  rows: RecipeRow[]; onRowsChange?: (rows: RecipeRow[]) => void;
}

/** Recipe edits are local drafts; ProductForm saves the complete recipe atomically. */
export default function RecipeManagerSlideOver({ open, onClose, outletId, rows, onRowsChange }: Props) {
  const runtime = useMerchantRuntime();
  if (!open) return null;
  return <RecipeEditor key={`${runtime?.scope ?? "owner"}:${outletId}`} outletId={outletId} rows={rows}
    onRowsChange={onRowsChange} onClose={onClose} />;
}
function RecipeEditor({ outletId, rows, onRowsChange, onClose }: Omit<Props, "open" | "productId">) {
  const request = useMerchantRequest();
  const runtime = useMerchantRuntime();
  const id = useId();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [quantity, setQuantity] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const latest = useRef({ rows, onRowsChange });
  useEffect(() => { latest.current = { rows, onRowsChange }; }, [rows, onRowsChange]);
  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await request(`/api/owner/ingredients?outlet_id=${encodeURIComponent(outletId)}`, { signal });
      const data = await response.json();
      if (signal.aborted || runtime?.active() === false) return;
      if (!response.ok) throw new Error(data.error || "Gagal memuat bahan baku");
      const list = data as Ingredient[];
      setIngredients(list);
      const next = latest.current.rows.map(row => {
        const ingredient = list.find(item => item.id === row.ingredient_id);
        return ingredient ? { ...row, cost_per_unit: ingredient.cost_per_unit } : row;
      });
      if (next.some((row, index) => row.cost_per_unit !== latest.current.rows[index].cost_per_unit)) latest.current.onRowsChange?.(next);
    } catch (e) {
      if (!signal.aborted && runtime?.active() !== false) setError(e instanceof Error ? e.message : "Gagal memuat bahan baku");
    } finally { if (!signal.aborted && runtime?.active() !== false) setLoading(false); }
  }, [outletId, request, runtime]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reset = () => { setEditing(null); setSelected(""); setQuantity(""); setError(""); };
  const saveRow = () => {
    const value = parseInventoryDecimal(quantity);
    if (!selected || value === null || value <= 0 || value > 9999999999.99) { setError("Pilih bahan dan isi jumlah positif, maksimal 2 desimal."); return; }
    const ingredient = ingredients.find(item => item.id === selected);
    const previous = rows.find(row => row.ingredient_id === selected);
    if (!ingredient || (!ingredient.is_active && !previous)) { setError("Bahan tidak tersedia"); return; }
    const row: RecipeRow = { id: previous?.id, ingredient_id: ingredient.id, ingredient_name: ingredient.name,
      ingredient_unit: ingredient.unit, quantity_used: value, cost_per_unit: ingredient.cost_per_unit };
    onRowsChange?.(editing ? rows.map(item => item.ingredient_id === editing ? row : item) : [...rows, row]);
    reset();
  };
  const total = rows.reduce((sum, row) => sum + row.quantity_used * (ingredients.find(item => item.id === row.ingredient_id)?.cost_per_unit ?? row.cost_per_unit ?? 0), 0);
  return <>
    <SlideOver open onClose={onClose} title="Komposisi Produk" subtitle="Pemakaian bahan per satu porsi. Perubahan disimpan bersama produk."
      footer={<button type="button" onClick={onClose} className="w-full min-h-12 rounded-xl bg-primary text-on-primary font-semibold">Selesai Mengatur</button>}>
      <div className="space-y-5">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <p className="text-sm text-on-surface-variant">Gunakan satuan bahan yang tertera.</p>
          <button type="button" onClick={() => setShowIngredientForm(true)} className="min-h-11 inline-flex items-center gap-2 text-sm font-semibold text-primary"><Plus size={16} />Tambah Bahan Baku</button>
        </div>
        {error && <p role="alert" className="text-sm text-error rounded-xl bg-error/5 p-3">{error}</p>}
        {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div> : <>
          <div className="rounded-xl bg-surface-container-low p-4 space-y-3">
            <label htmlFor={`${id}-ingredient`} className="block text-sm font-semibold text-on-surface">{editing ? "Ubah pemakaian bahan" : "Tambahkan bahan ke komposisi"}</label>
            <select id={`${id}-ingredient`} disabled={!!editing} className={inventorySelectClass} value={selected} onChange={event => setSelected(event.target.value)}>
              <option value="">Pilih bahan baku…</option>
              {ingredients.filter(item => editing ? item.id === editing : item.is_active && !rows.some(row => row.ingredient_id === item.id))
                .map(item => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
            </select>
            {!ingredients.some(item => item.is_active) && <p className="text-xs text-on-surface-variant">Belum ada bahan aktif. Tambahkan bahan baku melalui tombol di atas.</p>}
            <label htmlFor={`${id}-quantity`} className="block text-sm font-semibold text-on-surface">Jumlah per porsi {selected && `(${ingredients.find(item => item.id === selected)?.unit ?? ""})`}</label>
            <input id={`${id}-quantity`} type="number" min="0.01" step="0.01" inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); saveRow(); } }} className={inventoryInputClass} placeholder="Contoh: 18" />
            <div className="flex gap-2">
              <button type="button" onClick={saveRow} disabled={!selected || !quantity} className="min-h-11 px-4 rounded-xl bg-primary text-on-primary font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50">
                {editing ? <Check size={16} /> : <Plus size={16} />}{editing ? "Simpan Jumlah" : "Tambah ke Komposisi"}
              </button>
              {editing && <button type="button" onClick={reset} className="min-h-11 px-3 text-sm text-on-surface-variant inline-flex items-center gap-1"><X size={15} />Batal</button>}
            </div>
          </div>
          {!rows.length && <p className="text-center text-sm text-on-surface-variant py-6">Belum ada komposisi. Produk tanpa komposisi tidak memakai stok bahan.</p>}
          <div className="divide-y divide-surface-container">
            {rows.map(row => <div key={row.ingredient_id} className="py-3 flex items-center justify-between gap-2">
              <div className="min-w-0"><p className="font-semibold text-sm text-on-surface break-words">{row.ingredient_name}</p>
                <p className="text-xs text-on-surface-variant">{row.quantity_used.toLocaleString("id-ID")} {row.ingredient_unit} / porsi</p></div>
              <div className="flex shrink-0 gap-1">
                <button type="button" aria-label={`Ubah jumlah ${row.ingredient_name}`} onClick={() => { setEditing(row.ingredient_id); setSelected(row.ingredient_id); setQuantity(String(row.quantity_used)); setError(""); }} className="h-11 w-11 inline-flex items-center justify-center rounded-xl bg-surface-container text-on-surface-variant"><Pencil size={17} /></button>
                <button type="button" aria-label={`Hapus ${row.ingredient_name} dari komposisi`} onClick={() => { onRowsChange?.(rows.filter(item => item.ingredient_id !== row.ingredient_id)); if (editing === row.ingredient_id) reset(); }} className="h-11 w-11 inline-flex items-center justify-center rounded-xl bg-error/5 text-error"><Trash2 size={17} /></button>
              </div>
            </div>)}
          </div>
          {rows.length > 0 && <div className="p-4 rounded-xl bg-primary/5 text-primary"><p className="text-xs">Estimasi HPP per porsi</p><p className="font-bold text-lg">Rp {total.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</p><p className="text-xs mt-1">Menggunakan biaya bahan terakhir; belum termasuk biaya operasional.</p></div>}
        </>}
      </div>
    </SlideOver>
    <IngredientFormSlideOver open={showIngredientForm} outletId={outletId} onClose={() => setShowIngredientForm(false)} onSaved={ingredient => {
      setIngredients(previous => [...previous, ingredient].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected(ingredient.id); setEditing(null); setError("");
    }} />
  </>;
}
