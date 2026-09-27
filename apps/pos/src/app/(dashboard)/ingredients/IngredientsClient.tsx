"use client";

import { useState } from "react";
import Link from "next/link";
import { Ingredient } from "@rakku/shared-types";
import { formatCurrency } from "@/lib/format";
import { showToast, Badge, EmptyState, PageHeader, FormField, fieldInputClass } from "@rakku/ui";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { usePlan } from "@/components/billing/PlanProvider";
import { updateIngredient, deleteIngredient, adjustIngredientStock } from "@/lib/supabase/queries.client";
import {
  Plus,
  Search,
  Boxes,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ClipboardCheck,
  X,
  Check,
} from "lucide-react";

interface Props {
  ingredients: Ingredient[];
}

function formatStock(value: number): string {
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export default function IngredientsClient({ ingredients: initialIngredients }: Props) {
  const { hasFeature, openUpgrade } = usePlan();
  const [ingredientList, setIngredientList] = useState(initialIngredients);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [opnameIngredient, setOpnameIngredient] = useState<Ingredient | null>(null);
  const [opnameStock, setOpnameStock] = useState("");
  const [opnameNote, setOpnameNote] = useState("");
  const [opnameSaving, setOpnameSaving] = useState(false);

  const filtered = ingredientList.filter((i) => {
    if (search) {
      const q = search.toLowerCase();
      return i.name.toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const isLowStock = (i: Ingredient) =>
    i.min_stock_alert > 0 && i.stock_quantity <= i.min_stock_alert;

  const handleToggleActive = async (ingredient: Ingredient) => {
    const newActive = !ingredient.is_active;
    try {
      await updateIngredient(ingredient.id, { is_active: newActive });
      setIngredientList((prev) =>
        prev.map((i) =>
          i.id === ingredient.id ? { ...i, is_active: newActive } : i
        )
      );
      showToast(
        "success",
        `${ingredient.name} ${newActive ? "diaktifkan" : "dinonaktifkan"}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah status bahan baku";
      showToast("error", msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIngredient(id);
      setIngredientList((prev) => prev.filter((i) => i.id !== id));
      showToast("success", "Bahan baku berhasil dihapus");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus bahan baku";
      showToast("error", msg);
    }
  };

  const openOpname = (ingredient: Ingredient) => {
    if (!hasFeature("inventory_advanced")) {
      openUpgrade("Stock Opname tersedia di paket Pro.");
      return;
    }
    setOpnameIngredient(ingredient);
    setOpnameStock(String(ingredient.stock_quantity));
    setOpnameNote("");
    setOpnameSaving(false);
  };

  const handleOpname = async () => {
    if (!opnameIngredient) return;
    const newStock = Number(opnameStock);
    if (Number.isNaN(newStock) || newStock < 0) {
      showToast("error", "Stok hasil opname harus angka dan tidak boleh negatif");
      return;
    }
    setOpnameSaving(true);
    try {
      const res = await adjustIngredientStock(
        opnameIngredient.id,
        newStock,
        opnameNote.trim() || undefined
      );
      setIngredientList((prev) =>
        prev.map((i) =>
          i.id === opnameIngredient.id ? { ...i, stock_quantity: res.new_stock } : i
        )
      );
      showToast("success", "Opname berhasil disimpan");
      setOpnameIngredient(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan opname";
      showToast("error", msg);
      setOpnameSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Bahan Baku"
        subtitle="Kelola stok dan harga beli bahan untuk resep produk Anda."
        actions={
          <Link
            href="/ingredients/add"
            className="px-4 md:px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 hover:bg-primary/90 transition-all"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Tambah Bahan</span>
            <span className="sm:hidden">Tambah</span>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            placeholder="Cari bahan baku..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-surface-container-lowest border-none rounded-lg pl-11 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary outline-none transition-all"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl">
          <EmptyState
            icon={Boxes}
            title="Belum ada bahan baku"
            description="Mulai tambah bahan baku pertama Anda"
          />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-container">
                  {["Bahan", "Stok", "Stok Min", "Harga Beli", "Status", "Aksi"].map((h) => (
                    <th
                      key={h}
                      className={`text-label-caps uppercase text-on-surface-variant px-6 py-4 ${
                        h === "Aksi" ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {paginated.map((ingredient) => (
                  <tr
                    key={ingredient.id}
                    className="hover:bg-surface-container-low/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-on-surface truncate">
                        {ingredient.name}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        per {ingredient.unit}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-semibold text-on-surface">
                        {formatStock(ingredient.stock_quantity)} {ingredient.unit}
                      </span>
                      {isLowStock(ingredient) && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-warning">
                          <AlertTriangle size={12} />
                          Menipis
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-on-surface-variant">
                      {formatStock(ingredient.min_stock_alert)} {ingredient.unit}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-on-surface">
                      {formatCurrency(ingredient.cost_per_unit)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={ingredient.is_active ? "active" : "inactive"}>
                        {ingredient.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openOpname(ingredient)}
                          aria-label={`Opname ${ingredient.name}`}
                          title="Stock Opname"
                          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                        >
                          <ClipboardCheck size={18} />
                        </button>
                        <Link
                          href={`/ingredients/${ingredient.id}/edit`}
                          aria-label={`Edit ${ingredient.name}`}
                          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                        >
                          <Pencil size={18} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(ingredient)}
                          aria-label={
                            ingredient.is_active
                              ? `Nonaktifkan ${ingredient.name}`
                              : `Aktifkan ${ingredient.name}`
                          }
                          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                        >
                          {ingredient.is_active ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(ingredient.id)}
                          aria-label={`Hapus ${ingredient.name}`}
                          className="p-2 text-error hover:bg-error-container/20 rounded-full transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="grid gap-3 md:hidden">
            {paginated.map((ingredient) => (
              <div
                key={ingredient.id}
                className="bg-surface-container-lowest rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {ingredient.name}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {formatCurrency(ingredient.cost_per_unit)} / {ingredient.unit}
                    </p>
                  </div>
                  <Badge variant={ingredient.is_active ? "active" : "inactive"}>
                    {ingredient.is_active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-mono text-sm font-bold text-primary">
                    {formatStock(ingredient.stock_quantity)} {ingredient.unit}
                    {isLowStock(ingredient) && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-warning">
                        <AlertTriangle size={12} />
                        Menipis
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openOpname(ingredient)}
                      aria-label={`Opname ${ingredient.name}`}
                      className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                    >
                      <ClipboardCheck size={18} />
                    </button>
                    <Link
                      href={`/ingredients/${ingredient.id}/edit`}
                      aria-label={`Edit ${ingredient.name}`}
                      className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                    >
                      <Pencil size={18} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(ingredient)}
                      aria-label="Ubah status"
                      className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                    >
                      {ingredient.is_active ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(ingredient.id)}
                      aria-label={`Hapus ${ingredient.name}`}
                      className="p-2 text-error hover:bg-error-container/20 rounded-full transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-1">
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <span>Tampil</span>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-surface-container-lowest border-none rounded-lg px-2 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary outline-none"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span>dari {filtered.length} bahan</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Halaman sebelumnya"
                  className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
                  )
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-on-surface-variant">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPage(p)}
                        className={`min-w-[36px] h-9 rounded-lg text-sm font-semibold transition-colors ${
                          page === p
                            ? "bg-primary text-on-primary"
                            : "text-on-surface-variant hover:bg-surface-container"
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Halaman berikutnya"
                  className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) handleDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        title="Hapus Bahan Baku"
        message="Apakah kamu yakin ingin menghapus bahan baku ini? Resep produk yang memakai bahan ini juga akan terhapus. Tindakan ini tidak dapat dibatalkan."
      />

      {/* Opname Modal */}
      {opnameIngredient && (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm overflow-y-auto overscroll-contain">
          <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
            <div className="relative bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl shadow-md w-full sm:max-w-md mobile-slide-up pb-safe sm:pb-0 overflow-hidden flex flex-col">
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-surface-container-high" />
              </div>
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-surface-container">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-primary" />
                  <h3 className="text-base font-semibold text-on-surface">
                    Stock Opname
                  </h3>
                </div>
                <button
                  onClick={() => setOpnameIngredient(null)}
                  disabled={opnameSaving}
                  className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-4 sm:px-6 py-6 space-y-4">
                <div className="bg-surface-container rounded-xl p-4">
                  <p className="text-sm font-semibold text-on-surface">
                    {opnameIngredient.name}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Stok sistem saat ini:{" "}
                    <span className="font-mono font-semibold text-on-surface">
                      {formatStock(opnameIngredient.stock_quantity)}{" "}
                      {opnameIngredient.unit}
                    </span>
                  </p>
                </div>
                <FormField label="Stok hasil hitungan fisik" required>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={opnameStock}
                      onChange={(e) => setOpnameStock(e.target.value)}
                      placeholder="0"
                      className={fieldInputClass}
                    />
                    <span className="shrink-0 text-sm font-medium text-on-surface-variant">
                      {opnameIngredient.unit}
                    </span>
                  </div>
                </FormField>
                <FormField label="Catatan (opsional)">
                  <input
                    type="text"
                    value={opnameNote}
                    onChange={(e) => setOpnameNote(e.target.value)}
                    placeholder="Mis. sisa fisik setelah cek gudang..."
                    className={fieldInputClass}
                  />
                </FormField>
                <p className="text-xs text-on-surface-variant">
                  Selisih stok otomatis dicatat sebagai{" "}
                  <span className="font-semibold">adjustment</span> di riwayat
                  pergerakan stok.
                </p>
              </div>
              <div className="px-4 sm:px-6 py-4 border-t border-surface-container flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpnameIngredient(null)}
                  disabled={opnameSaving}
                  className="flex-1 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleOpname}
                  disabled={opnameSaving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  <Check size={18} />
                  {opnameSaving ? "Menyimpan..." : "Simpan Opname"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
