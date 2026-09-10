"use client";

import { useState } from "react";
import { Expense } from "@rakku/shared-types";
import { formatCurrency } from "@/lib/format";
import {
  showToast,
  Badge,
  EmptyState,
  PageHeader,
  FormField,
  fieldInputClass,
  fieldSelectClass,
} from "@rakku/ui";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createExpense, updateExpense, deleteExpense } from "@/lib/supabase/queries.client";
import {
  Plus,
  Search,
  Wallet,
  Pencil,
  Trash2,
  X,
  Check,
  Calendar,
} from "lucide-react";

interface Props {
  expenses: Expense[];
}

const PRESET_CATEGORIES = [
  "Listrik",
  "Air",
  "Galon",
  "Plastik / Kemasan",
  "Gaji",
  "Sewa",
  "Bahan Lain",
  "Lainnya",
];

interface FormState {
  category: string;
  amount: string;
  description: string;
  expenseDate: string;
}

const emptyForm: FormState = {
  category: "",
  amount: "",
  description: "",
  expenseDate: "",
};

function toInputDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ExpensesClient({ expenses: initialExpenses }: Props) {
  const [expenseList, setExpenseList] = useState(initialExpenses);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = expenseList.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.category.toLowerCase().includes(q) ||
      (e.description ?? "").toLowerCase().includes(q)
    );
  });

  const totalAmount = filtered.reduce((sum, e) => sum + e.amount, 0);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsCustomCategory(false);
    setModalOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    const preset = PRESET_CATEGORIES.includes(expense.category);
    setIsCustomCategory(!preset);
    setForm({
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description ?? "",
      expenseDate: toInputDate(expense.expense_date),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    const amount = Number(form.amount);
    if (!form.category.trim()) {
      showToast("error", "Kategori wajib diisi");
      return;
    }
    if (!amount || amount <= 0) {
      showToast("error", "Nominal harus lebih dari 0");
      return;
    }
    setSaving(true);

    const payload = {
      category: form.category.trim(),
      amount,
      description: form.description.trim() || undefined,
      expense_date: form.expenseDate ? new Date(`${form.expenseDate}T12:00:00`).toISOString() : undefined,
    };

    try {
      if (editing) {
        await updateExpense(editing.id, payload);
        setExpenseList((prev) =>
          prev.map((e) =>
            e.id === editing.id
              ? {
                  ...e,
                  category: payload.category,
                  amount: payload.amount,
                  description: payload.description ?? null,
                  expense_date: payload.expense_date ?? e.expense_date,
                }
              : e
          )
        );
        showToast("success", "Pengeluaran berhasil diupdate");
      } else {
        const created = await createExpense(payload);
        setExpenseList((prev) => [created, ...prev]);
        showToast("success", "Pengeluaran berhasil dicatat");
      }
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteExpense(id);
      setExpenseList((prev) => prev.filter((e) => e.id !== id));
      showToast("success", "Pengeluaran berhasil dihapus");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus pengeluaran";
      showToast("error", msg);
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  };

  const modalBody = (
    <div className="space-y-4">
      <FormField label="Kategori" htmlFor="expense-category" required>
        {isCustomCategory ? (
          <div className="flex items-center gap-2">
            <input
              id="expense-category"
              type="text"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Tulis kategori baru..."
              className={fieldInputClass}
            />
            <button
              type="button"
              onClick={() => {
                setIsCustomCategory(false);
                setForm((f) => ({ ...f, category: "" }));
              }}
              className="shrink-0 px-3 py-2.5 rounded-lg text-xs font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              Pilih
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              id="expense-category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={fieldSelectClass}
            >
              <option value="">Pilih kategori...</option>
              {PRESET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsCustomCategory(true)}
              className="shrink-0 px-3 py-2.5 rounded-lg text-xs font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              Custom
            </button>
          </div>
        )}
      </FormField>

      <FormField label="Nominal (Rp)" htmlFor="expense-amount" required>
        <input
          id="expense-amount"
          type="number"
          min={0}
          inputMode="numeric"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          placeholder="0"
          className={fieldInputClass}
        />
      </FormField>

      <FormField label="Deskripsi" htmlFor="expense-desc">
        <input
          id="expense-desc"
          type="text"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Mis. galon isi ulang, bayar listrik..."
          className={fieldInputClass}
        />
      </FormField>

      <FormField label="Tanggal" htmlFor="expense-date">
        <div className="relative">
          <Calendar
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            id="expense-date"
            type="date"
            value={form.expenseDate}
            onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
            className={`${fieldInputClass} !pl-11`}
          />
        </div>
      </FormField>
    </div>
  );

  const modalActions = (
    <>
      <button
        type="button"
        onClick={closeModal}
        disabled={saving}
        className="flex-1 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant active:scale-[0.98] transition-all disabled:opacity-60"
      >
        Batal
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-60"
      >
        <Check size={18} />
        {saving ? "Menyimpan..." : editing ? "Simpan" : "Tambah"}
      </button>
    </>
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Pengeluaran"
        subtitle="Catat pengeluaran operasional harian agar masuk hitungan laba rugi."
        actions={
          <button
            type="button"
            onClick={openAdd}
            className="px-4 md:px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 hover:bg-primary/90 transition-all"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Tambah Pengeluaran</span>
            <span className="sm:hidden">Tambah</span>
          </button>
        }
      />

      {/* Total ringkasan */}
      <div className="bg-surface-container-lowest rounded-xl p-5 mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet size={22} className="text-primary" />
          </div>
          <div>
            <p className="text-label-caps uppercase text-on-surface-variant">Total Pengeluaran</p>
            <p className="text-headline-sm font-bold text-on-surface font-mono">
              {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>
        <Badge variant="active">
          {filtered.length} {filtered.length === 1 ? "item" : "item"}
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            placeholder="Cari kategori atau deskripsi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-lowest border-none rounded-lg pl-11 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary outline-none transition-all"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl">
          <EmptyState
            icon={Wallet}
            title="Belum ada pengeluaran"
            description="Catat pengeluaran operasional pertama Anda"
          />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-container">
                  {["Tanggal", "Kategori", "Deskripsi", "Nominal", "Aksi"].map((h) => (
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
                {filtered.map((expense) => (
                  <tr
                    key={expense.id}
                    className="hover:bg-surface-container-low/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-on-surface-variant whitespace-nowrap">
                      {new Date(expense.expense_date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="active">{expense.category}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface truncate max-w-[240px]">
                      {expense.description || "—"}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm font-semibold text-error">
                      -{formatCurrency(expense.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(expense)}
                          aria-label={`Edit ${expense.category}`}
                          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(expense.id)}
                          aria-label={`Hapus ${expense.category}`}
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
            {filtered.map((expense) => (
              <div
                key={expense.id}
                className="bg-surface-container-lowest rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {expense.category}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {new Date(expense.expense_date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-error shrink-0">
                    -{formatCurrency(expense.amount)}
                  </span>
                </div>
                {expense.description && (
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {expense.description}
                  </p>
                )}
                <div className="flex items-center justify-end gap-1 mt-2">
                  <button
                    type="button"
                    onClick={() => openEdit(expense)}
                    aria-label={`Edit ${expense.category}`}
                    className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(expense.id)}
                    aria-label={`Hapus ${expense.category}`}
                    className="p-2 text-error hover:bg-error-container/20 rounded-full transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Add/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm overflow-y-auto overscroll-contain">
          <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
            <div className="relative bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl shadow-md w-full sm:max-w-md mobile-slide-up pb-safe sm:pb-0 overflow-hidden flex flex-col">
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-surface-container-high" />
              </div>
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-surface-container">
                <h3 className="text-base font-semibold text-on-surface">
                  {editing ? "Edit Pengeluaran" : "Tambah Pengeluaran"}
                </h3>
                <button
                  onClick={closeModal}
                  className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-4 sm:px-6 py-6">{modalBody}</div>
              <div className="px-4 sm:px-6 py-4 border-t border-surface-container flex gap-2">
                {modalActions}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) handleDelete(pendingDeleteId);
        }}
        title="Hapus Pengeluaran"
        message="Apakah kamu yakin ingin menghapus pengeluaran ini? Tindakan ini tidak dapat dibatalkan."
        loading={deleting}
      />
    </div>
  );
}
