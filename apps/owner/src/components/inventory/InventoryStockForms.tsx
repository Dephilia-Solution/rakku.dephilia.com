"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type { Ingredient } from "@rakku/shared-types";
import { FormField, SlideOver } from "@rakku/ui";
import { Plus, Trash2 } from "lucide-react";
import { usePlan } from "@/components/billing/PlanProvider";
import {
  InventoryError, InventoryFormFooter, inventoryInputClass, inventoryNumber,
  inventoryPanelClass, inventoryRupiah, inventorySecondaryClass, inventorySelectClass,
  parseInventoryDecimal, useInventorySession,
} from "./InventoryFormUI";

interface StockFormProps {
  outletId: string;
  onClose: () => void;
  onSaved: () => void;
}

const ADVANCED_MESSAGE = "Pembelian dan stock opname tersedia di paket dengan fitur inventori lanjutan.";

/** Keep the same idempotency key after a network error until the submitted payload changes. */
function requestIdFor(ref: { current: { body: string; id: string } | null }, body: string) {
  if (!ref.current || ref.current.body !== body) ref.current = { body, id: crypto.randomUUID() };
  return ref.current.id;
}

export function IngredientOpnameSlideOver({ outletId, ingredient, onClose, onSaved }: StockFormProps & { ingredient: Ingredient }) {
  const { request, showToast, begin } = useInventorySession(outletId);
  const { hasFeature, openUpgrade } = usePlan();
  const id = useId();
  const formId = `${id}-opname`;
  const [quantity, setQuantity] = useState(String(ingredient.stock_quantity));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const submission = useRef<{ body: string; id: string } | null>(null);
  const physical = parseInventoryDecimal(quantity);
  const difference = physical === null ? null : Math.round((physical - Number(ingredient.stock_quantity)) * 100) / 100;
  const close = () => { if (!pending.current) onClose(); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const session = begin();
    if (!session || pending.current) return;
    if (!hasFeature("inventory_advanced")) { openUpgrade(ADVANCED_MESSAGE); return; }
    if (physical === null) { setError("Stok fisik harus nol atau lebih, maksimal 2 desimal."); return; }
    if (!note.trim()) { setError("Catatan wajib diisi untuk menjelaskan penyesuaian stok."); return; }
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      const payload = { outlet_id: outletId, quantity: physical, note: note.trim() };
      const requestId = requestIdFor(submission, JSON.stringify({ id: ingredient.id, ...payload }));
      const response = await request(`/api/owner/ingredients/${encodeURIComponent(ingredient.id)}/adjust`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, request_id: requestId }), signal: session.signal,
      });
      const data = await response.json();
      if (!session.active()) return;
      if (!response.ok) {
        const message = data.error ?? "Gagal menyimpan stock opname.";
        setError(message);
        if (data.code === "PLAN_LIMIT") openUpgrade(message);
        return;
      }
      showToast("success", `Stok ${ingredient.name} menjadi ${inventoryNumber(data.new_stock)} ${ingredient.unit}`);
      onSaved();
      onClose();
    } catch {
      if (session.active()) setError("Gagal menyimpan stock opname. Coba lagi; pengiriman ulang data yang sama tidak menggandakan penyesuaian.");
    } finally {
      pending.current = false;
      if (session.active()) setSaving(false);
    }
  };

  return <div className={inventoryPanelClass}>
    <SlideOver open onClose={close} title="Stock Opname" subtitle={ingredient.name}
      footer={<InventoryFormFooter formId={formId} saving={saving} onClose={close} label="Simpan Opname" />}>
      <form id={formId} onSubmit={submit} className="space-y-5" aria-busy={saving}>
        <InventoryError message={error} />
        <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
          Stok tercatat: <strong className="text-on-surface">{inventoryNumber(ingredient.stock_quantity)} {ingredient.unit}</strong>.
          Masukkan jumlah fisik hasil hitung, bukan jumlah penambahan atau pengurangan.
        </p>
        <fieldset disabled={saving} className="space-y-5">
          <FormField label={`Stok Fisik (${ingredient.unit})`} htmlFor={`${id}-quantity`} required>
            <input id={`${id}-quantity`} autoFocus type="number" min="0" step="0.01" inputMode="decimal" required value={quantity} onChange={(event) => setQuantity(event.target.value)} className={inventoryInputClass} />
          </FormField>
          <FormField label="Catatan Penyesuaian" htmlFor={`${id}-note`} required hint="Contoh: Hasil hitung stok akhir bulan, selisih bahan rusak.">
            <textarea id={`${id}-note`} rows={3} required value={note} onChange={(event) => setNote(event.target.value)} className={inventoryInputClass} />
          </FormField>
        </fieldset>
        {difference !== null && <p className="text-sm text-on-surface-variant" aria-live="polite">
          Perkiraan selisih: <strong className={difference < 0 ? "text-error" : "text-primary"}>{difference > 0 ? "+" : ""}{inventoryNumber(difference)} {ingredient.unit}</strong>.
          Selisih akhir dihitung dari stok terbaru saat disimpan.
        </p>}
      </form>
    </SlideOver>
  </div>;
}

interface PurchaseLine {
  key: number;
  ingredientId: string;
  quantity: string;
  cost: string;
}

function todayLocal() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function IngredientPurchaseSlideOver({ outletId, ingredients, onClose, onSaved }: StockFormProps & { ingredients: Ingredient[] }) {
  const { request, showToast, begin } = useInventorySession(outletId);
  const { hasFeature, openUpgrade } = usePlan();
  const id = useId();
  const formId = `${id}-purchase`;
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(todayLocal);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([{ key: 0, ingredientId: "", quantity: "", cost: "" }]);
  const nextKey = useRef(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const submission = useRef<{ body: string; id: string } | null>(null);
  const available = ingredients.filter((ingredient) => ingredient.is_active && ingredient.outlet_id === outletId);
  const close = () => { if (!pending.current) onClose(); };
  const updateLine = (key: number, values: Partial<PurchaseLine>) => setLines((previous) => previous.map((line) => line.key === key ? { ...line, ...values } : line));
  const subtotal = (line: PurchaseLine) => {
    const quantity = parseInventoryDecimal(line.quantity);
    const cost = parseInventoryDecimal(line.cost);
    return quantity === null || cost === null ? 0 : Math.round(quantity * cost * 100) / 100;
  };
  const total = lines.reduce((sum, line) => sum + Math.round(subtotal(line) * 100), 0) / 100;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const session = begin();
    if (!session || pending.current) return;
    if (!hasFeature("inventory_advanced")) { openUpgrade(ADVANCED_MESSAGE); return; }
    const purchasedAt = new Date(`${date}T00:00:00`);
    if (!date || Number.isNaN(purchasedAt.getTime())) { setError("Tanggal pembelian wajib diisi dengan tanggal yang valid."); return; }
    const items: { ingredient_id: string; quantity: number; unit_cost: number }[] = [];
    for (const [index, line] of lines.entries()) {
      const quantity = parseInventoryDecimal(line.quantity);
      const cost = parseInventoryDecimal(line.cost);
      if (!available.some((ingredient) => ingredient.id === line.ingredientId)) {
        setError(`Pilih bahan aktif pada baris ${index + 1}.`); return;
      }
      if (items.some((item) => item.ingredient_id === line.ingredientId)) {
        setError("Bahan yang sama cukup dimasukkan dalam satu baris."); return;
      }
      if (quantity === null || quantity <= 0 || cost === null) {
        setError(`Baris ${index + 1}: jumlah harus lebih dari nol dan harga tidak boleh negatif, maksimal 2 desimal.`); return;
      }
      items.push({ ingredient_id: line.ingredientId, quantity, unit_cost: cost });
    }
    if (!items.length || !Number.isSafeInteger(Math.round(total * 100))) {
      setError("Periksa bahan, jumlah, dan total pembelian."); return;
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      const payload = { outlet_id: outletId, supplier: supplier.trim(), date: purchasedAt.toISOString(), note: note.trim(), items };
      const requestId = requestIdFor(submission, JSON.stringify(payload));
      const response = await request("/api/owner/purchases", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, request_id: requestId }), signal: session.signal,
      });
      const data = await response.json();
      if (!session.active()) return;
      if (!response.ok) {
        const message = data.error ?? "Gagal menyimpan pembelian.";
        setError(message);
        if (data.code === "PLAN_LIMIT") openUpgrade(message);
        return;
      }
      showToast("success", `Pembelian ${inventoryRupiah(data.total_amount)} berhasil dicatat`);
      onSaved();
      onClose();
    } catch {
      if (session.active()) setError("Gagal menyimpan pembelian. Coba lagi; pengiriman ulang data yang sama tidak menggandakan stok.");
    } finally {
      pending.current = false;
      if (session.active()) setSaving(false);
    }
  };

  return <div className={inventoryPanelClass}>
    <SlideOver open onClose={close} title="Catat Pembelian" subtitle="Pembelian otomatis menambah stok bahan." widthClassName="max-w-2xl"
      footer={<InventoryFormFooter formId={formId} saving={saving} onClose={close} label="Simpan Pembelian" />}>
      <form id={formId} onSubmit={submit} className="space-y-5" aria-busy={saving}>
        <InventoryError message={error} />
        <fieldset disabled={saving} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Supplier" htmlFor={`${id}-supplier`} hint="Opsional">
              <input id={`${id}-supplier`} autoFocus value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Nama pemasok" className={inventoryInputClass} />
            </FormField>
            <FormField label="Tanggal Pembelian" htmlFor={`${id}-date`} required>
              <input id={`${id}-date`} type="date" required value={date} onChange={(event) => setDate(event.target.value)} className={`${inventoryInputClass} min-w-0`} />
            </FormField>
          </div>
          <div className="space-y-4">
            {lines.map((line, index) => {
              const selected = available.find((ingredient) => ingredient.id === line.ingredientId);
              return <div key={line.key} className="rounded-xl border border-surface-container p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-on-surface">Bahan {index + 1}</h3>
                  <button type="button" disabled={lines.length === 1} onClick={() => setLines((previous) => previous.filter((item) => item.key !== line.key))}
                    className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-error hover:bg-error/5 disabled:opacity-40 active:scale-[0.98]" aria-label={`Hapus baris bahan ${index + 1}`}><Trash2 size={18} /></button>
                </div>
                <FormField label="Bahan" htmlFor={`${id}-ingredient-${line.key}`} required>
                  <select id={`${id}-ingredient-${line.key}`} required value={line.ingredientId} className={inventorySelectClass}
                    onChange={(event) => {
                      const ingredient = available.find((item) => item.id === event.target.value);
                      updateLine(line.key, { ingredientId: event.target.value, cost: ingredient ? String(ingredient.cost_per_unit) : "" });
                    }}>
                    <option value="">Pilih bahan...</option>
                    {available.map((ingredient) => <option key={ingredient.id} value={ingredient.id} disabled={lines.some((item) => item.key !== line.key && item.ingredientId === ingredient.id)}>{ingredient.name} ({ingredient.unit})</option>)}
                  </select>
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label={`Jumlah${selected ? ` (${selected.unit})` : ""}`} htmlFor={`${id}-quantity-${line.key}`} required>
                    <input id={`${id}-quantity-${line.key}`} type="number" min="0.01" step="0.01" inputMode="decimal" required value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} className={inventoryInputClass} />
                  </FormField>
                  <FormField label={`Harga per ${selected?.unit ?? "Satuan"} (Rp)`} htmlFor={`${id}-cost-${line.key}`} required>
                    <input id={`${id}-cost-${line.key}`} type="number" min="0" step="0.01" inputMode="decimal" required value={line.cost} onChange={(event) => updateLine(line.key, { cost: event.target.value })} className={inventoryInputClass} />
                  </FormField>
                </div>
                <p className="text-right text-sm text-on-surface-variant">Subtotal: <strong className="text-on-surface tabular-nums">{inventoryRupiah(subtotal(line))}</strong></p>
              </div>;
            })}
            <button type="button" className={inventorySecondaryClass} onClick={() => {
              const key = nextKey.current++;
              setLines((previous) => [...previous, { key, ingredientId: "", quantity: "", cost: "" }]);
            }}><Plus size={16} />Tambah Baris</button>
          </div>
          <FormField label="Catatan" htmlFor={`${id}-note`} hint="Opsional, misalnya nomor faktur atau keterangan pengiriman.">
            <textarea id={`${id}-note`} rows={3} value={note} onChange={(event) => setNote(event.target.value)} className={inventoryInputClass} />
          </FormField>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/5 p-4" aria-live="polite">
          <span className="text-sm font-semibold text-on-surface">Total Pembelian</span>
          <strong className="text-xl text-primary tabular-nums break-all">{inventoryRupiah(total)}</strong>
        </div>
      </form>
    </SlideOver>
  </div>;
}
