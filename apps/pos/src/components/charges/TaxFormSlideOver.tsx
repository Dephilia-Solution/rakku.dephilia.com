"use client";

import { useState, useEffect } from "react";
import { Tax } from "@rakku/shared-types";
import {
  SlideOver,
  FormField,
  fieldInputClass,
  showToast,
} from "@rakku/ui";

interface Props {
  open: boolean;
  onClose: () => void;
  tax: Tax | null;
  onSuccess: () => void;
}

export default function TaxFormSlideOver({ open, onClose, tax, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState(0);
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(tax?.name ?? "");
      setType(tax?.type ?? "percentage");
      setValue(tax?.value ?? 0);
      setSortOrder(tax?.sort_order ?? 0);
      setSaving(false);
    }
  }, [open, tax]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast("error", "Nama pajak wajib diisi");
      return;
    }
    if (value <= 0) {
      showToast("error", "Nilai pajak harus lebih dari 0");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), type, value, sort_order: sortOrder };
      const res = await fetch("/api/admin/taxes", {
        method: tax ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tax ? { id: tax.id, ...payload } : payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Gagal menyimpan pajak");
      }
      showToast("success", tax ? "Pajak berhasil diperbarui" : "Pajak berhasil ditambahkan");
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan pajak";
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={tax ? "Edit Pajak" : "Tambah Pajak"}
      subtitle="Pajak diterapkan pada pesanan di kasir"
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
        <FormField label="Nama Pajak" htmlFor="tax-name" required>
          <input
            id="tax-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: PPN, Service Tax"
            className={fieldInputClass}
          />
        </FormField>

        <FormField label="Tipe" required>
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
          htmlFor="tax-value"
          required
        >
          <input
            id="tax-value"
            type="number"
            min={0}
            value={value || ""}
            onChange={(e) => setValue(Number(e.target.value) || 0)}
            placeholder={type === "percentage" ? "Contoh: 10" : "Contoh: 5000"}
            className={fieldInputClass}
          />
        </FormField>

        <FormField label="Urutan" htmlFor="tax-sort" hint="Urutan penerapan saat ada beberapa pajak">
          <input
            id="tax-sort"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            className={`w-28 ${fieldInputClass}`}
          />
        </FormField>
      </div>
    </SlideOver>
  );
}
