"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type { Ingredient, IngredientUnit } from "@rakku/shared-types";
import { FormField } from "@rakku/ui";
import SlideOver from "@/components/ui/OwnerSheet";
import { usePlan } from "@/components/billing/PlanProvider";
import { useMerchantRuntime } from "@/lib/merchant-runtime";
import {
  InventoryError, InventoryFormFooter, inventoryInputClass, inventoryPanelClass,
  inventorySelectClass, parseInventoryDecimal, useInventorySession,
} from "./InventoryFormUI";

export interface IngredientFormSlideOverProps {
  open: boolean;
  onClose: () => void;
  outletId: string;
  ingredient?: Ingredient | null;
  onSaved: (ingredient: Ingredient) => void;
}

const UNITS: IngredientUnit[] = ["gram", "ml", "pcs", "kg", "liter"];

/** Can be opened from either the outlet inventory or a product's recipe picker. */
export default function IngredientFormSlideOver(props: IngredientFormSlideOverProps) {
  const runtime = useMerchantRuntime();
  if (!props.open) return null;
  return <IngredientForm key={`${runtime?.scope ?? "owner"}:${props.outletId}:${props.ingredient?.id ?? "new"}`} {...props} />;
}

function IngredientForm({ onClose, outletId, ingredient, onSaved }: IngredientFormSlideOverProps) {
  const { request, showToast, begin } = useInventorySession(outletId);
  const { openUpgrade } = usePlan();
  const id = useId();
  const formId = `${id}-ingredient`;
  const [name, setName] = useState(ingredient?.name ?? "");
  const [code, setCode] = useState(ingredient?.code ?? "");
  const [unit, setUnit] = useState<IngredientUnit>(ingredient?.unit ?? "gram");
  const [stock, setStock] = useState(String(ingredient?.stock_quantity ?? 0));
  const [minimum, setMinimum] = useState(String(ingredient?.min_stock_alert ?? 0));
  const [cost, setCost] = useState(String(ingredient?.cost_per_unit ?? 0));
  const [active, setActive] = useState(ingredient?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const createReceipt = useRef<{ signature: string; id: string } | null>(null);

  const close = () => { if (!pending.current) onClose(); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const session = begin();
    if (!session || pending.current) return;
    const minimumValue = parseInventoryDecimal(minimum);
    const costValue = parseInventoryDecimal(cost);
    const stockValue = ingredient ? null : parseInventoryDecimal(stock);
    if (!name.trim()) { setError("Nama bahan wajib diisi."); return; }
    if (minimumValue === null || costValue === null || (!ingredient && stockValue === null)) {
      setError("Stok, batas minimum, dan harga harus berupa angka nol atau lebih, maksimal 2 desimal.");
      return;
    }
    if (ingredient && ingredient.outlet_id !== outletId) {
      setError("Bahan ini berasal dari outlet lain. Buka kembali bahan dari outlet yang sesuai.");
      return;
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      const fields = { outlet_id: outletId, code: code.trim() || undefined, name: name.trim(), unit, min_stock_alert: minimumValue, cost_per_unit: costValue };
      if (!ingredient) {
        const signature = JSON.stringify({ ...fields, stock_quantity: stockValue });
        if (createReceipt.current?.signature !== signature) createReceipt.current = { signature, id: crypto.randomUUID() };
      }
      const response = await request("/api/owner/ingredients", {
        method: ingredient ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ingredient ? { ...fields, id: ingredient.id, is_active: active } : { ...fields, stock_quantity: stockValue, request_id: createReceipt.current!.id }),
        signal: session.signal,
      });
      const data = await response.json();
      if (!session.active()) return;
      if (!response.ok) {
        const message = data.error ?? "Gagal menyimpan bahan baku.";
        setError(message);
        if (data.code === "PLAN_LIMIT") openUpgrade(message);
        return;
      }
      showToast("success", ingredient ? "Bahan baku diperbarui" : "Bahan baku ditambahkan");
      onSaved(data as Ingredient);
      onClose();
    } catch {
      if (session.active()) setError("Gagal menyimpan bahan baku. Periksa koneksi lalu coba lagi.");
    } finally {
      pending.current = false;
      if (session.active()) setSaving(false);
    }
  };

  return (
    <div className={inventoryPanelClass}>
      <SlideOver open onClose={close} title={ingredient ? "Edit Bahan Baku" : "Tambah Bahan Baku"}
        subtitle="Satuan dipakai untuk stok, pembelian, dan resep."
        footer={<InventoryFormFooter formId={formId} saving={saving} onClose={close} />}>
        <form id={formId} onSubmit={submit} className="space-y-5" aria-busy={saving}>
          <InventoryError message={error} />
          <fieldset disabled={saving} className="space-y-5">
            <FormField label="Nama Bahan" htmlFor={`${id}-name`} required>
              <input id={`${id}-name`} required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Biji kopi arabika" className={inventoryInputClass} />
            </FormField>
            <FormField label="Kode Bahan" htmlFor={`${id}-code`} hint={ingredient ? "Kode adalah identifier tetap bahan." : "Opsional. Kosongkan untuk membuat kode outlet otomatis."}>
              <input id={`${id}-code`} value={code} readOnly={!!ingredient} onChange={(event) => setCode(event.target.value)} placeholder="Contoh: BHN001" className={`${inventoryInputClass} read-only:opacity-70`} />
            </FormField>
            <FormField label="Satuan" htmlFor={`${id}-unit`} required hint={ingredient ? "Perubahan satuan dapat ditolak jika bahan sudah dipakai dalam resep atau riwayat stok." : "Gunakan satuan yang sama saat mengisi resep dan pembelian."}>
              <select id={`${id}-unit`} value={unit} onChange={(event) => setUnit(event.target.value as IngredientUnit)} className={inventorySelectClass}>
                {UNITS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </FormField>
            <FormField label={ingredient ? `Stok Saat Ini (${ingredient.unit})` : `Stok Awal (${unit})`} htmlFor={`${id}-stock`}
              hint={ingredient ? "Untuk mengubah stok, gunakan Stock Opname di daftar bahan." : "Stok awal akan dicatat dalam riwayat stok."} required={!ingredient}>
              <input id={`${id}-stock`} type="number" min="0" step="0.01" inputMode="decimal" required={!ingredient} readOnly={!!ingredient} value={stock} onChange={(event) => setStock(event.target.value)} className={`${inventoryInputClass} read-only:opacity-60`} />
            </FormField>
            <FormField label={`Batas Stok Minimum (${unit})`} htmlFor={`${id}-minimum`} required hint="Bahan ditandai menipis saat stok mencapai batas ini.">
              <input id={`${id}-minimum`} type="number" min="0" step="0.01" inputMode="decimal" required value={minimum} onChange={(event) => setMinimum(event.target.value)} className={inventoryInputClass} />
            </FormField>
            <FormField label={`Harga per ${unit} (Rp)`} htmlFor={`${id}-cost`} required>
              <input id={`${id}-cost`} type="number" min="0" step="0.01" inputMode="decimal" required value={cost} onChange={(event) => setCost(event.target.value)} className={inventoryInputClass} />
            </FormField>
            {ingredient && <FormField label="Status" htmlFor={`${id}-active`}>
              <select id={`${id}-active`} value={active ? "active" : "inactive"} onChange={(event) => setActive(event.target.value === "active")} className={inventorySelectClass}>
                <option value="active">Aktif</option><option value="inactive">Nonaktif</option>
              </select>
            </FormField>}
          </fieldset>
        </form>
      </SlideOver>
    </div>
  );
}
