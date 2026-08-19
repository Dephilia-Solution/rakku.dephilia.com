"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Grid3X3,
  Plus,
  Pencil,
  Trash2,
  Building2,
  X,
  Search,
  AlertCircle,
} from "lucide-react";
import { showToast } from "@rakku/ui";

interface DiningTable {
  id: string;
  company_id: string;
  outlet_id: string;
  name: string;
  status: "available" | "occupied";
  created_at: string;
  outlet_name?: string | null;
}

interface OutletOption {
  id: string;
  name: string;
}

interface Props {
  outlets: OutletOption[];
}

export default function OwnerTablesClient({ outlets }: Props) {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [outletId, setOutletId] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [formName, setFormName] = useState("");
  const [formOutletId, setFormOutletId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DiningTable | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (showForm || deleteTarget) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showForm, deleteTarget]);

  const fetchTables = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = outletId
        ? `/api/owner/tables?outlet_id=${encodeURIComponent(outletId)}`
        : "/api/owner/tables";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setTables(data.tables ?? []);
      } else {
        showToast("error", data.error || "Gagal memuat data meja");
      }
    } catch {
      showToast("error", "Gagal memuat data meja");
    } finally {
      setIsLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const filtered = tables.filter((t) => {
    if (!search) return true;
    return t.name.toLowerCase().includes(search.toLowerCase());
  });

  const availableCount = filtered.filter((t) => t.status === "available").length;
  const occupiedCount = filtered.length - availableCount;

  const openCreateForm = () => {
    setEditingTable(null);
    setFormName("");
    setFormOutletId(outletId || outlets[0]?.id || "");
    setShowForm(true);
  };

  const openEditForm = (table: DiningTable) => {
    setEditingTable(table);
    setFormName(table.name);
    setFormOutletId(table.outlet_id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast("error", "Nama meja harus diisi");
      return;
    }
    if (!editingTable && !formOutletId) {
      showToast("error", "Pilih outlet untuk meja");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingTable) {
        const res = await fetch("/api/owner/tables", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingTable.id, name: formName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast("error", data.error || "Gagal mengupdate meja");
          setIsSubmitting(false);
          return;
        }
        showToast("success", "Meja berhasil diupdate");
      } else {
        const res = await fetch("/api/owner/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName.trim(), outlet_id: formOutletId }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast("error", data.error || "Gagal membuat meja");
          setIsSubmitting(false);
          return;
        }
        showToast("success", "Meja berhasil ditambahkan");
      }
      setShowForm(false);
      fetchTables();
    } catch {
      showToast("error", "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (table: DiningTable) => {
    const next = table.status === "available" ? "occupied" : "available";
    try {
      const res = await fetch("/api/owner/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: table.id, status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Gagal mengubah status");
        return;
      }
      showToast("success", next === "occupied" ? "Meja ditandai terisi" : "Meja tersedia kembali");
      fetchTables();
    } catch {
      showToast("error", "Terjadi kesalahan");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/owner/tables?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Gagal menghapus meja");
        return;
      }
      showToast("success", "Meja berhasil dihapus");
      setDeleteTarget(null);
      fetchTables();
    } catch {
      showToast("error", "Terjadi kesalahan");
    }
  };

  const statusBadge = (status: string) =>
    status === "available"
      ? "bg-success/10 text-success"
      : "bg-amber-100 text-amber-800";

  const statusLabel = (status: string) =>
    status === "available" ? "Tersedia" : "Terisi";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Meja</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Kelola meja dan status kosong/terisi untuk order dine-in.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all"
        >
          <Plus size={16} />
          Tambah Meja
        </button>
      </div>

      {/* Filters: outlet + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-on-surface-variant flex-shrink-0" />
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="bg-surface-container-lowest border border-surface-container rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="">Semua Outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            placeholder="Cari nama meja..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-lowest border border-surface-container rounded-xl pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: filtered.length, color: "text-on-surface" },
          { label: "Tersedia", value: availableCount, color: "text-success" },
          { label: "Terisi", value: occupiedCount, color: "text-error" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container-lowest rounded-2xl border border-surface-container p-4"
          >
            <p className="text-xs text-on-surface-variant mb-1">{stat.label}</p>
            <p className={`font-mono text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-surface-container-lowest rounded-2xl border border-surface-container animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-12 text-center">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Grid3X3 size={32} className="text-on-surface-variant" />
          </div>
          <h3 className="font-bold text-on-surface mb-1">Belum ada meja</h3>
          <p className="text-sm text-on-surface-variant mb-4">
            Tambahkan meja untuk outlet Anda.
          </p>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all"
          >
            <Plus size={16} />
            Tambah Meja
          </button>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container-low border-b border-surface-container">
                <tr>
                  <th className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-6 py-3">Nama</th>
                  <th className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-6 py-3">Outlet</th>
                  <th className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-6 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {filtered.map((table) => (
                  <tr key={table.id} className="hover:bg-surface-container-low">
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-on-surface">{table.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-on-surface-variant">
                        {table.outlet_name || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button type="button" onClick={() => handleToggleStatus(table)}>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge(table.status)}`}
                        >
                          {statusLabel(table.status)}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditForm(table)}
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-all"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(table)}
                          className="p-2 text-on-surface-variant hover:text-error hover:bg-surface-container rounded-lg transition-all"
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-surface-container">
            {filtered.map((table) => (
              <div key={table.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <Grid3X3 size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{table.name}</p>
                      <p className="text-xs text-on-surface-variant">{table.outlet_name || "-"}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleToggleStatus(table)}>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge(table.status)}`}
                    >
                      {statusLabel(table.status)}
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditForm(table)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-container-low text-on-surface-variant text-xs font-semibold rounded-lg hover:bg-surface-container transition-all"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(table)}
                    className="px-3 py-2 bg-surface-container-low text-error text-xs font-semibold rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-surface-container-lowest rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-md max-h-[90dvh] overflow-hidden flex flex-col animate-slide-up pb-4 md:animate-bounce-in">
            <div className="flex items-center justify-between p-6 border-b border-surface-container bg-surface-container-lowest">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Grid3X3 size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-on-surface">
                    {editingTable ? "Edit Meja" : "Tambah Meja"}
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    {editingTable
                      ? "Ubah nama meja."
                      : "Buat meja baru untuk salah satu outlet."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 pb-[env(safe-area-inset-bottom,0px)]">
              {!editingTable && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Outlet
                  </label>
                  <select
                    value={formOutletId}
                    onChange={(e) => setFormOutletId(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-base text-on-surface outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  >
                    <option value="">Pilih outlet...</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Nama Meja
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Meja 1"
                  required
                  className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-base text-on-surface placeholder-neutral-400 outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2 sticky bottom-0 bg-surface-container-lowest">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-sm font-semibold rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : editingTable ? (
                    "Simpan Perubahan"
                  ) : (
                    "Tambah Meja"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation */}
      {deleteTarget && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-surface-container-lowest rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 animate-slide-up pb-4 md:animate-bounce-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-danger/10 rounded-xl flex items-center justify-center text-error">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-on-surface">Hapus Meja?</h2>
                <p className="text-sm text-on-surface-variant">
                  Tindakan ini tidak bisa dibatalkan.
                </p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">
              Anda akan menghapus meja{" "}
              <span className="font-bold">{deleteTarget.name}</span> dari outlet{" "}
              <span className="font-bold">{deleteTarget.outlet_name || "-"}</span>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-5 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-sm font-semibold rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-5 py-3 bg-danger hover:bg-danger/90 text-white text-sm font-semibold rounded-xl transition-all"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}