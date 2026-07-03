"use client";

import { useState, useEffect, useCallback } from "react";
import { Tax } from "@/types";
import { showToast } from "@/components/shared/Toast";
import TaxManager from "@/components/admin/TaxManager";
import { Plus, Pencil, Trash2, DollarSign } from "lucide-react";

export default function TaxesPage() {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManager, setShowManager] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);

  const fetchTaxes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/taxes");
      if (res.ok) {
        const data = await res.json();
        setTaxes(data ?? []);
      }
    } catch {
      showToast("error", "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTaxes();
  }, [fetchTaxes]);

  const handleAdd = () => {
    setEditingTax(null);
    setShowManager(true);
  };

  const handleEdit = (tax: Tax) => {
    setEditingTax(tax);
    setShowManager(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus tax ini?")) return;
    try {
      const res = await fetch(`/api/admin/taxes?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Tax berhasil dihapus");
        fetchTaxes();
      } else {
        const data = await res.json();
        showToast("error", data.error ?? "Gagal menghapus");
      }
    } catch {
      showToast("error", "Gagal menghapus");
    }
  };

  const handleSave = async (data: { name: string; type: "percentage" | "fixed"; value: number; sort_order: number }) => {
    if (editingTax) {
      const res = await fetch("/api/admin/taxes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTax.id, ...data }),
      });
      if (!res.ok) throw new Error("Gagal update");
    } else {
      const res = await fetch("/api/admin/taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Gagal tambah");
    }
  };

  const handleToggleActive = async (tax: Tax) => {
    try {
      const res = await fetch("/api/admin/taxes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tax.id, is_active: !tax.is_active }),
      });
      if (res.ok) {
        showToast("success", tax.is_active ? "Tax dinonaktifkan" : "Tax diaktifkan");
        fetchTaxes();
      } else {
        const data = await res.json();
        showToast("error", data.error ?? "Gagal mengubah status");
      }
    } catch {
      showToast("error", "Gagal mengubah status");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold text-neutral-900">
            Kelola Tax
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Atur pajak untuk outlet ini (PPN, Service, dll.)
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 bg-forest text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-forest-dark transition-colors"
        >
          <Plus size={16} />
          Tambah Tax
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-neutral-400 text-sm">Memuat...</div>
      ) : taxes.length === 0 ? (
        <div className="text-center py-12 text-neutral-400 text-sm border border-dashed border-neutral-200 rounded-xl">
          <DollarSign size={32} className="mx-auto mb-2 opacity-50" />
          Belum ada tax. Klik &quot;Tambah Tax&quot; untuk memulai.
        </div>
      ) : (
        <div className="space-y-2">
          {taxes.map((tax) => (
            <div
              key={tax.id}
              className="flex items-center justify-between bg-white rounded-xl border border-neutral-200 px-4 py-3 hover:border-neutral-300 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-neutral-900">
                    {tax.name}
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">
                    {tax.type === "percentage" ? `${tax.value}%` : `Rp ${tax.value.toLocaleString("id-ID")}`}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  tax.is_active
                    ? "bg-success/10 text-success"
                    : "bg-neutral-100 text-neutral-400"
                }`}>
                  {tax.is_active ? "Aktif" : "Nonaktif"}
                </span>
                <span className="text-xs text-neutral-400">
                  Urutan: {tax.sort_order}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleActive(tax)}
                  className={`p-2 rounded-lg hover:bg-neutral-100 transition-colors ${
                    tax.is_active ? "text-neutral-400 hover:text-warning" : "text-neutral-400 hover:text-success"
                  }`}
                  title={tax.is_active ? "Nonaktifkan" : "Aktifkan"}
                >
                  <span className="text-xs font-medium">
                    {tax.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </span>
                </button>
                <button
                  onClick={() => handleEdit(tax)}
                  className="p-2 text-neutral-400 hover:text-forest rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(tax.id)}
                  className="p-2 text-neutral-400 hover:text-danger rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showManager && (
        <TaxManager
          tax={editingTax}
          onSave={handleSave}
          onClose={() => {
            setShowManager(false);
            setEditingTax(null);
          }}
          onSuccess={() => {
            setShowManager(false);
            setEditingTax(null);
            fetchTaxes();
          }}
        />
      )}
    </div>
  );
}
