"use client";

import { useState } from "react";
import { DiningTable } from "@rakku/shared-types";
import { showToast, Badge, EmptyState, PageHeader, FormField, fieldInputClass } from "@rakku/ui";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createTable, updateTable, deleteTable, generateTables } from "@/lib/supabase/queries.client";
import { Plus, Search, Grid3X3, Pencil, Trash2, X, Check, Wand2 } from "lucide-react";

interface Props {
  tables: DiningTable[];
}

interface FormState {
  name: string;
}

const emptyForm: FormState = { name: "" };

export default function TablesClient({ tables: initialTables }: Props) {
  const [tableList, setTableList] = useState(initialTables);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DiningTable | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateCount, setGenerateCount] = useState("5");
  const [generating, setGenerating] = useState(false);

  const filtered = tableList.filter((t) => {
    if (!search) return true;
    return t.name.toLowerCase().includes(search.toLowerCase());
  });

  const availableCount = tableList.filter((t) => t.status === "available").length;
  const occupiedCount = tableList.length - availableCount;

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (table: DiningTable) => {
    setEditing(table);
    setForm({ name: table.name });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast("error", "Nama meja wajib diisi");
      return;
    }
    setSaving(true);

    try {
      if (editing) {
        const updated = await updateTable(editing.id, { name: form.name.trim() });
        setTableList((prev) =>
          prev.map((t) => (t.id === editing.id ? { ...t, ...updated } : t))
        );
        showToast("success", "Meja berhasil diupdate");
      } else {
        const created = await createTable(form.name.trim());
        setTableList((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        showToast("success", "Meja berhasil ditambahkan");
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

  const handleToggleStatus = async (table: DiningTable) => {
    const next = table.status === "available" ? "occupied" : "available";
    try {
      const updated = await updateTable(table.id, { status: next });
      setTableList((prev) =>
        prev.map((t) => (t.id === table.id ? { ...t, ...updated } : t))
      );
      showToast("success", next === "occupied" ? "Meja ditandai terisi" : "Meja tersedia kembali");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah status";
      showToast("error", msg);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteTable(id);
      setTableList((prev) => prev.filter((t) => t.id !== id));
      showToast("success", "Meja berhasil dihapus");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus meja";
      showToast("error", msg);
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  };

  const handleGenerate = async () => {
    const count = Number(generateCount);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      showToast("error", "Jumlah meja harus 1-100");
      return;
    }
    setGenerating(true);
    try {
      const created = await generateTables(count);
      setTableList((prev) => [...prev, ...created].sort((a, b) => a.name.localeCompare(b.name)));
      showToast("success", `${created.length} meja berhasil dibuat`);
      setGenerateOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal generate meja";
      showToast("error", msg);
    } finally {
      setGenerating(false);
    }
  };

  const modalBody = (
    <div className="space-y-4">
      <FormField label="Nama Meja" htmlFor="table-name" required>
        <input
          id="table-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Contoh: Meja 1"
          className={fieldInputClass}
        />
      </FormField>
    </div>
  );

  const modalActions = (
    <>
      <button
        type="button"
        onClick={closeModal}
        disabled={saving}
        className="flex-1 px-4 py-3 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-60"
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
        title="Meja"
        subtitle="Kelola meja sederhana â€” status kosong/terisi untuk order dine-in."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGenerateOpen(true)}
              className="px-4 md:px-6 py-2.5 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high flex items-center gap-2 transition-all"
            >
              <Wand2 size={16} />
              <span className="hidden sm:inline">Generate</span>
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="px-4 md:px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 hover:bg-primary/90 transition-all"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Tambah Meja</span>
              <span className="sm:hidden">Tambah</span>
            </button>
          </div>
        }
      />

      {/* Ringkasan status */}
      <div className="bg-surface-container-lowest rounded-xl p-5 mb-5 grid grid-cols-3 gap-4">
        <div>
          <p className="text-label-caps uppercase text-on-surface-variant">Total</p>
          <p className="text-headline-sm font-bold text-on-surface font-mono">{tableList.length}</p>
        </div>
        <div>
          <p className="text-label-caps uppercase text-on-surface-variant">Tersedia</p>
          <p className="text-headline-sm font-bold text-success font-mono">{availableCount}</p>
        </div>
        <div>
          <p className="text-label-caps uppercase text-on-surface-variant">Terisi</p>
          <p className="text-headline-sm font-bold text-error font-mono">{occupiedCount}</p>
        </div>
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
            placeholder="Cari nama meja..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-lowest border-none rounded-lg pl-11 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary outline-none transition-all"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl">
          <EmptyState
            icon={Grid3X3}
            title="Belum ada meja"
            description="Tambah meja satu per satu atau gunakan tombol Generate"
          />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-container">
                  {["Nama", "Status", "Aksi"].map((h) => (
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
                {filtered.map((table) => (
                  <tr key={table.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-on-surface">{table.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <button type="button" onClick={() => handleToggleStatus(table)}>
                        <Badge variant={table.status === "available" ? "active" : "warning"}>
                          {table.status === "available" ? "Tersedia" : "Terisi"}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(table)}
                          aria-label={`Edit ${table.name}`}
                          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(table.id)}
                          aria-label={`Hapus ${table.name}`}
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
            {filtered.map((table) => (
              <div key={table.id} className="bg-surface-container-lowest rounded-xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{table.name}</p>
                  </div>
                  <button type="button" onClick={() => handleToggleStatus(table)}>
                    <Badge variant={table.status === "available" ? "active" : "warning"}>
                      {table.status === "available" ? "Tersedia" : "Terisi"}
                    </Badge>
                  </button>
                </div>
                <div className="flex items-center justify-end gap-1 mt-2">
                  <button
                    type="button"
                    onClick={() => openEdit(table)}
                    aria-label={`Edit ${table.name}`}
                    className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(table.id)}
                    aria-label={`Hapus ${table.name}`}
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
                  {editing ? "Edit Meja" : "Tambah Meja"}
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

      {/* Modal Generate */}
      {generateOpen && (
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm overflow-y-auto overscroll-contain">
          <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
            <div className="relative bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl shadow-md w-full sm:max-w-md mobile-slide-up pb-safe sm:pb-0 overflow-hidden flex flex-col">
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-surface-container-high" />
              </div>
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-surface-container">
                <h3 className="text-base font-semibold text-on-surface">Generate Meja</h3>
                <button
                  onClick={() => setGenerateOpen(false)}
                  className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-4 sm:px-6 py-6 space-y-4">
                <FormField label="Jumlah Meja" htmlFor="generate-count" required>
                  <input
                    id="generate-count"
                    type="number"
                    min={1}
                    max={100}
                    value={generateCount}
                    onChange={(e) => setGenerateCount(e.target.value)}
                    className={fieldInputClass}
                  />
                </FormField>
                <p className="text-xs text-on-surface-variant">
                  Meja akan dibuat dengan nama berurutan (Meja 1, Meja 2, ...) melanjutkan nomor terakhir yang sudah ada.
                </p>
              </div>
              <div className="px-4 sm:px-6 py-4 border-t border-surface-container flex gap-2">
                <button
                  type="button"
                  onClick={() => setGenerateOpen(false)}
                  disabled={generating}
                  className="flex-1 px-4 py-3 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-primary text-on-primary shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  <Wand2 size={18} />
                  {generating ? "Membuat..." : "Generate"}
                </button>
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
        title="Hapus Meja"
        message="Apakah kamu yakin ingin menghapus meja ini? Tindakan ini tidak dapat dibatalkan."
        loading={deleting}
      />
    </div>
  );
}
