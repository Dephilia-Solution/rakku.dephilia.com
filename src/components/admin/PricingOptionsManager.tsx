"use client";

import { useState } from "react";
import { PricingOption } from "@/types";
import { formatCurrency } from "@/lib/dummy-data";
import { showToast } from "@/components/shared/Toast";
import { Plus, Trash2, GripHorizontal } from "lucide-react";

interface Props {
  productId: string;
  options: PricingOption[];
  onOptionsChange: (options: PricingOption[]) => void;
}

export default function PricingOptionsManager({ productId, options, onOptionsChange }: Props) {
  const [form, setForm] = useState({ name: "", price: "" });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const name = form.name.trim();
    const price = Number(form.price);
    if (!name) {
      showToast("error", "Nama opsi harga harus diisi");
      return;
    }
    if (isNaN(price) || price <= 0) {
      showToast("error", "Harga tidak valid");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/tenant/session");
      let companyId = "";
      let outletId = "";
      if (res.ok) {
        const s = await res.json();
        companyId = s.company_id;
        outletId = s.outlet_id;
      }

      const response = await fetch("/api/admin/pricing-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          name,
          price,
          company_id: companyId,
          outlet_id: outletId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }

      const created = await response.json();
      onOptionsChange([...options, created]);
      setForm({ name: "", price: "" });
      showToast("success", "Opsi harga berhasil ditambahkan");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menambah opsi harga";
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (option: PricingOption) => {
    try {
      const response = await fetch(`/api/admin/pricing-options?id=${option.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }

      onOptionsChange(options.filter((o) => o.id !== option.id));
      showToast("success", "Opsi harga berhasil dihapus");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus opsi harga";
      showToast("error", msg);
    }
  };

  return (
    <div className="border-t border-neutral-200 pt-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <GripHorizontal size={14} className="text-neutral-400" />
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
          Opsi Harga Tambahan (opsional)
        </span>
      </div>

      {options.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {options.map((opt) => (
            <div key={opt.id} className="flex items-center justify-between bg-neutral-50 rounded-xl px-3 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm text-neutral-900 truncate">{opt.name}</span>
                <span className="text-xs font-mono text-forest font-semibold whitespace-nowrap">
                  {formatCurrency(opt.price)}
                </span>
              </div>
              <button
                onClick={() => handleDelete(opt)}
                className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center text-neutral-400 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nama opsi (Gojek Regular)"
          className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest min-w-0"
        />
        <input
          type="number"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          placeholder="Harga"
          className="w-24 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm font-mono text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
        />
        <button
          onClick={handleAdd}
          disabled={saving}
          className="w-9 h-9 rounded-xl bg-forest text-white flex items-center justify-center hover:bg-forest-dark active:scale-[0.97] transition-all flex-shrink-0 disabled:opacity-50"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
