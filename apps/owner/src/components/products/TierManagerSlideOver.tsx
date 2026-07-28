"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PricingTier } from "@rakku/shared-types";
import { SlideOver, showToast, fieldInputClass, Toggle } from "@rakku/ui";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
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
import { GripVertical, Pencil, Trash2, Check, X, Plus, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  outletId: string;
  onTiersChange?: (tiers: PricingTier[]) => void;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function SortableTierItem({
  tier,
  isEditing,
  editName,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onEditNameChange,
  onToggleActive,
  onDelete,
}: {
  tier: PricingTier;
  isEditing: boolean;
  editName: string;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onEditNameChange: (v: string) => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tier.id,
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
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">
                {tier.name}
              </p>
              <p className="text-xs text-on-surface-variant font-mono">
                {tier.slug}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Toggle
              checked={tier.is_active}
              onChange={onToggleActive}
              ariaLabel={`Status ${tier.name}`}
            />
            <button
              type="button"
              onClick={onStartEdit}
              aria-label={`Ubah ${tier.name}`}
              className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Hapus ${tier.name}`}
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

export default function TierManagerSlideOver({
  open,
  onClose,
  outletId,
  onTiersChange,
}: Props) {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const items = useMemo(
    () => [...tiers].sort((a, b) => a.sort_order - b.sort_order),
    [tiers]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const onTiersChangeRef = useRef(onTiersChange);
  useEffect(() => { onTiersChangeRef.current = onTiersChange; }, [onTiersChange]);

  const applyTiers = useCallback((next: PricingTier[]) => {
    setTiers(next);
    onTiersChangeRef.current?.(next);
  }, []);

  const fetchTiers = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/owner/pricing-tiers?outlet_id=${encodeURIComponent(outletId)}`
      );
      if (res.ok) {
        const data = await res.json();
        applyTiers(data.tiers ?? []);
      }
    } catch {
      showToast("error", "Gagal memuat data tier");
    } finally {
      setLoading(false);
    }
  }, [outletId, applyTiers]);

  useEffect(() => {
    if (open) fetchTiers();
  }, [open, fetchTiers]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const maxSort = tiers.reduce((m, t) => Math.max(m, t.sort_order), 0);
      const res = await fetch("/api/owner/pricing-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: outletId,
          name,
          slug: slugify(name),
          sort_order: maxSort + 1,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Gagal menambah tier");
      }
      setNewName("");
      showToast("success", "Tier berhasil ditambahkan");
      await fetchTiers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menambah tier";
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editId || !editName.trim()) return;
    try {
      const res = await fetch(`/api/owner/pricing-tiers/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          slug: slugify(editName),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Gagal mengupdate tier");
      }
      setEditId(null);
      setEditName("");
      showToast("success", "Tier berhasil diupdate");
      await fetchTiers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengupdate tier";
      showToast("error", msg);
    }
  };

  const handleToggleActive = async (tier: PricingTier) => {
    try {
      const res = await fetch(`/api/owner/pricing-tiers/${tier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !tier.is_active }),
      });
      if (res.ok) {
        applyTiers(
          tiers.map((t) =>
            t.id === tier.id ? { ...t, is_active: !t.is_active } : t
          )
        );
        showToast(
          "success",
          `${tier.name} ${tier.is_active ? "dinonaktifkan" : "diaktifkan"}`
        );
      }
    } catch {
      showToast("error", "Gagal mengubah status tier");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/owner/pricing-tiers/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("success", "Tier berhasil dihapus");
        await fetchTiers();
      } else {
        const data = await res.json();
        showToast("error", data.error ?? "Gagal menghapus");
      }
    } catch {
      showToast("error", "Gagal menghapus");
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
      const updated = reordered.map((t, idx) => ({ ...t, sort_order: idx }));

      applyTiers(updated);

      try {
        const res = await fetch("/api/owner/pricing-tiers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orders: updated.map((t) => ({ id: t.id, sort_order: t.sort_order })),
          }),
        });
        if (!res.ok) throw new Error("Gagal menyimpan urutan");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal menyimpan urutan";
        showToast("error", msg);
        applyTiers(tiers);
      }
    },
    [items, tiers, applyTiers]
  );

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title="Kelola Tier Harga"
        subtitle="Tier dipakai untuk harga per tipe pesanan — seret untuk urutkan"
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
            placeholder="Tier baru, mis. GoFood..."
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

        {loading ? (
          <div className="flex items-center justify-center py-12 text-on-surface-variant">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="text-sm text-on-surface-variant text-center py-8">
                    Belum ada tier harga
                  </p>
                )}
                {items.map((tier) => (
                  <SortableTierItem
                    key={tier.id}
                    tier={tier}
                    isEditing={editId === tier.id}
                    editName={editId === tier.id ? editName : ""}
                    onStartEdit={() => {
                      setEditId(tier.id);
                      setEditName(tier.name);
                    }}
                    onCommitEdit={handleSaveEdit}
                    onCancelEdit={() => setEditId(null)}
                    onEditNameChange={setEditName}
                    onToggleActive={() => handleToggleActive(tier)}
                    onDelete={() => setPendingDeleteId(tier.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </SlideOver>

      <ConfirmDialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) handleDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        title="Hapus Pricing Tier"
        message="Apakah kamu yakin ingin menghapus pricing tier ini? Harga produk pada tier ini ikut terhapus."
      />
    </>
  );
}
