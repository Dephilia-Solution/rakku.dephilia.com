"use client";

import { useState } from "react";
import { Category } from "@/types";
import { showToast } from "@/components/shared/Toast";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/supabase/queries.client";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Layers,
  GripVertical,
} from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";

interface Props {
  initialCategories: Category[];
}

export default function AdminCategoriesClient({ initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const handleAdd = async () => {
    if (!newCategory.trim()) return;

    let companyId = "";
    let outletId = "";
    try {
      const res = await fetch("/api/auth/tenant/session");
      if (res.ok) {
        const s = await res.json();
        companyId = s.company_id;
        outletId = s.outlet_id;
      }
    } catch {}

    try {
      const data = await createCategory(newCategory.trim(), companyId, outletId);
      setCategories((prev) => [
        ...prev,
        { id: data.id, name: data.name, sort_order: data.sort_order },
      ]);
      setNewCategory("");
      showToast("success", "Kategori berhasil ditambahkan");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menambah kategori";
      showToast("error", msg);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setEditValue(category.name);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editValue.trim()) return;
    try {
      await updateCategory(id, editValue.trim());
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: editValue.trim() } : c))
      );
      setEditingId(null);
      showToast("success", "Kategori berhasil diupdate");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengupdate kategori";
      showToast("error", msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      showToast("success", "Kategori berhasil dihapus");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus kategori";
      showToast("error", msg);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="font-display font-bold text-xl sm:text-2xl text-neutral-900 mb-6">
        Kategori
      </h1>

      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Nama kategori baru..."
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
          />
          <button
            onClick={handleAdd}
            disabled={!newCategory.trim()}
            className="bg-forest text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus size={16} />
            Tambah
          </button>
        </div>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Belum ada kategori"
          description="Tambahkan kategori untuk mengelompokkan produk"
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {categories
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors"
              >
                <div className="text-neutral-300 cursor-grab">
                  <GripVertical size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  {editingId === category.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleSaveEdit(category.id)
                        }
                        className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm text-neutral-900 focus:outline-none focus:border-forest"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(category.id)}
                        className="w-7 h-7 rounded-lg bg-forest text-white flex items-center justify-center"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-400 flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900">
                        {category.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 bg-neutral-100 rounded-md px-1.5 py-0.5">
                        Urutan {category.sort_order}
                      </span>
                    </div>
                  )}
                </div>
                {editingId !== category.id && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(category)}
                      className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-700 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
