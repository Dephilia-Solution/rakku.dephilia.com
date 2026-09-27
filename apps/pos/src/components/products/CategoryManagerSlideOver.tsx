"use client";

import { useState, useCallback, useMemo } from "react";
import { Category } from "@rakku/shared-types";
import { SlideOver, showToast, fieldInputClass } from "@rakku/ui";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "@/lib/supabase/queries.client";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Check, X, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onCategoriesChange: (next: Category[]) => void;
}

function SortableCategoryItem({
  cat,
  isEditing,
  editName,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onEditNameChange,
  onDelete,
}: {
  cat: Category;
  isEditing: boolean;
  editName: string;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onEditNameChange: (v: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
    disabled: isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-2 p-3.5 bg-surface-container-low rounded-xl group"
    >
      {isEditing ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            autoFocus
            className={`flex-1 ${fieldInputClass} !py-2`}
          />
          <button
            type="button"
            onClick={onCommitEdit}
            aria-label="Simpan"
            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <Check size={18} />
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            aria-label="Batal"
            className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-on-surface-variant/50 hover:text-on-surface-variant flex-shrink-0 rounded transition-colors"
              {...attributes}
              {...listeners}
              aria-label="Seret untuk urutkan"
            >
              <GripVertical size={18} />
            </button>
            <span className="text-sm font-semibold text-on-surface truncate">
              {cat.name}
            </span>
          </div>
          <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onStartEdit}
              aria-label={`Ubah ${cat.name}`}
              className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Hapus ${cat.name}`}
              className="p-2 text-error hover:bg-error-container/20 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function CategoryManagerSlideOver({
  open,
  onClose,
  categories,
  onCategoriesChange,
}: Props) {
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const items = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || saving) return;
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
      const data = await createCategory(name, companyId, outletId);
      onCategoriesChange([
        ...categories,
        { id: data.id, name: data.name, sort_order: data.sort_order },
      ]);
      setNewName("");
      showToast("success", "Kategori berhasil ditambahkan");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menambah kategori";
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editId || !editName.trim()) return;
    try {
      await updateCategory(editId, editName.trim());
      onCategoriesChange(
        categories.map((c) =>
          c.id === editId ? { ...c, name: editName.trim() } : c
        )
      );
      setEditId(null);
      setEditName("");
      showToast("success", "Kategori berhasil diupdate");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengupdate kategori";
      showToast("error", msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      onCategoriesChange(categories.filter((c) => c.id !== id));
      showToast("success", "Kategori berhasil dihapus");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus kategori";
      showToast("error", msg);
    }
  };

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      const updated = reordered.map((cat, idx) => ({ ...cat, sort_order: idx }));

      onCategoriesChange(updated);

      try {
        await reorderCategories(
          updated.map((cat) => ({ id: cat.id, sort_order: cat.sort_order }))
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal menyimpan urutan";
        showToast("error", msg);
        onCategoriesChange(categories);
      }
    },
    [items, categories, onCategoriesChange]
  );

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title="Kelola Kategori"
        subtitle="Tambah, ubah, atau hapus kategori produk — seret untuk urutkan"
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
        <div className="flex gap-2 mb-5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Kategori baru..."
            className={`flex-1 ${fieldInputClass}`}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Plus size={16} />
            Tambah
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.length === 0 && (
                <p className="text-sm text-on-surface-variant text-center py-8">
                  Belum ada kategori
                </p>
              )}
              {items.map((cat) => (
                <SortableCategoryItem
                  key={cat.id}
                  cat={cat}
                  isEditing={editId === cat.id}
                  editName={editId === cat.id ? editName : ""}
                  onStartEdit={() => {
                    setEditId(cat.id);
                    setEditName(cat.name);
                  }}
                  onCommitEdit={handleSaveEdit}
                  onCancelEdit={() => setEditId(null)}
                  onEditNameChange={setEditName}
                  onDelete={() => setPendingDeleteId(cat.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </SlideOver>

      <ConfirmDialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) handleDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        title="Hapus Kategori"
        message="Apakah kamu yakin ingin menghapus kategori ini? Produk di kategori ini tidak ikut terhapus."
      />
    </>
  );
}
