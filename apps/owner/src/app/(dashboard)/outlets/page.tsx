"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { showToast } from "@rakku/ui";

interface Outlet {
  id: string;
  name: string;
  address: string | null;
  status: "active" | "inactive";
  created_at: string;
  employee_count: number;
}

export default function OwnerOutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Outlet | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll saat salah satu modal terbuka
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

  const fetchOutlets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/owner/outlets");
      const data = await res.json();
      if (res.ok) {
        setOutlets(data.outlets || []);
      }
    } catch {
      showToast("error", "Gagal memuat data outlet");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOutlets();
  }, [fetchOutlets]);

  const openCreateForm = () => {
    setEditingOutlet(null);
    setFormName("");
    setFormAddress("");
    setShowForm(true);
  };

  const openEditForm = (outlet: Outlet) => {
    setEditingOutlet(outlet);
    setFormName(outlet.name);
    setFormAddress(outlet.address || "");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast("error", "Nama outlet harus diisi");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingOutlet) {
        const res = await fetch(`/api/owner/outlets/${editingOutlet.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            address: formAddress.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast("error", data.error || "Gagal mengupdate outlet");
          setIsSubmitting(false);
          return;
        }
        showToast("success", "Outlet berhasil diupdate");
      } else {
        const res = await fetch("/api/owner/outlets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            address: formAddress.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast("error", data.error || "Gagal membuat outlet");
          setIsSubmitting(false);
          return;
        }
        showToast("success", "Outlet berhasil dibuat");
      }
      setShowForm(false);
      fetchOutlets();
    } catch {
      showToast("error", "Terjadi kesalahan");
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (outlet: Outlet) => {
    try {
      const res = await fetch(`/api/owner/outlets/${outlet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggle_status: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Gagal mengubah status");
        return;
      }
      showToast(
        "success",
        `Outlet ${data.status === "active" ? "diaktifkan" : "dinonaktifkan"}`
      );
      fetchOutlets();
    } catch {
      showToast("error", "Terjadi kesalahan");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/owner/outlets/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Gagal menghapus outlet");
        return;
      }
      showToast("success", "Outlet berhasil dihapus");
      setDeleteTarget(null);
      fetchOutlets();
    } catch {
      showToast("error", "Terjadi kesalahan");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Outlet</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Kelola cabang/outlet bisnis Anda.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-forest text-white text-sm font-semibold rounded-xl hover:bg-forest-dark transition-all"
        >
          <Plus size={16} />
          Tambah Outlet
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 bg-white rounded-2xl border border-neutral-200 animate-pulse"
            />
          ))}
        </div>
      ) : outlets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={32} className="text-neutral-400" />
          </div>
          <h3 className="font-bold text-neutral-900 mb-1">Belum ada outlet</h3>
          <p className="text-sm text-neutral-400 mb-4">
            Tambahkan outlet pertama Anda untuk mulai berjualan.
          </p>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-forest text-white text-sm font-semibold rounded-xl hover:bg-forest-dark transition-all"
          >
            <Plus size={16} />
            Tambah Outlet
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Nama</th>
                  <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Alamat</th>
                  <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Karyawan</th>
                  <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {outlets.map((outlet) => (
                  <tr key={outlet.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-forest/10 rounded-xl flex items-center justify-center text-forest">
                          <Building2 size={18} />
                        </div>
                        <span className="text-sm font-semibold text-neutral-900">{outlet.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {outlet.address ? (
                        <span className="text-sm text-neutral-500 line-clamp-2 max-w-[200px]">{outlet.address}</span>
                      ) : (
                        <span className="text-sm text-neutral-300 italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-500">{outlet.employee_count} karyawan</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          outlet.status === "active"
                            ? "bg-success/10 text-success"
                            : "bg-neutral-200 text-neutral-400"
                        }`}
                      >
                        {outlet.status === "active" ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditForm(outlet)}
                          className="p-2 text-neutral-400 hover:text-forest hover:bg-neutral-100 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(outlet)}
                          className="p-2 text-neutral-400 hover:text-forest hover:bg-neutral-100 rounded-lg transition-all"
                          title={outlet.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                        >
                          {outlet.status === "active" ? <X size={16} /> : <Check size={16} />}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(outlet)}
                          className="p-2 text-neutral-400 hover:text-danger hover:bg-neutral-100 rounded-lg transition-all"
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
          <div className="md:hidden divide-y divide-neutral-100">
            {outlets.map((outlet) => (
              <div key={outlet.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-forest/10 rounded-xl flex items-center justify-center text-forest">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{outlet.name}</p>
                      <p className="text-xs text-neutral-400">{outlet.employee_count} karyawan</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      outlet.status === "active"
                        ? "bg-success/10 text-success"
                        : "bg-neutral-200 text-neutral-400"
                    }`}
                  >
                    {outlet.status === "active" ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                {outlet.address ? (
                  <p className="text-xs text-neutral-400 flex items-start gap-1.5 mb-3">
                    <MapPin size={12} className="flex-shrink-0 mt-0.5" />
                    <span>{outlet.address}</span>
                  </p>
                ) : (
                  <p className="text-xs text-neutral-300 italic mb-3">Tanpa alamat</p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditForm(outlet)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-50 text-neutral-600 text-xs font-semibold rounded-lg hover:bg-neutral-100 transition-all"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    onClick={() => handleToggleStatus(outlet)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-50 text-neutral-600 text-xs font-semibold rounded-lg"
                  >
                    {outlet.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(outlet)}
                    className="px-3 py-2 bg-neutral-50 text-danger text-xs font-semibold rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Modal — rendered via portal ke document.body */}
      {showForm && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-md max-h-[90dvh] overflow-hidden flex flex-col animate-slide-up pb-4 md:animate-bounce-in">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-forest/10 rounded-xl flex items-center justify-center text-forest">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-neutral-900">
                    {editingOutlet ? "Edit Outlet" : "Tambah Outlet"}
                  </h2>
                  <p className="text-xs text-neutral-400">
                    {editingOutlet ? "Ubah data outlet." : "Buat outlet baru untuk bisnis Anda."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 pb-[env(safe-area-inset-bottom,0px)]">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Nama Outlet
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Outlet Utama"
                  required
                  className="w-full px-4 py-3 bg-neutral-50 border border-transparent rounded-xl text-base text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Alamat{" "}
                  <span className="text-neutral-400 normal-case font-normal">(opsional)</span>
                </label>
                <textarea
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Jl. Contoh No. 1, Jakarta"
                  rows={3}
                  className="w-full px-4 py-3 bg-neutral-50 border border-transparent rounded-xl text-base text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-forest focus:ring-1 focus:ring-forest transition-all resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-sm font-semibold rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-forest hover:bg-forest-dark text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : editingOutlet ? (
                    "Simpan Perubahan"
                  ) : (
                    "Tambah Outlet"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation — rendered via portal ke document.body */}
      {deleteTarget && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 animate-slide-up pb-4 md:animate-bounce-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-danger/10 rounded-xl flex items-center justify-center text-danger">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-neutral-900">
                  Hapus Outlet?
                </h2>
                <p className="text-sm text-neutral-400">
                  Tindakan ini tidak bisa dibatalkan.
                </p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 mb-6">
              Anda akan menghapus outlet{" "}
              <span className="font-bold">{deleteTarget.name}</span> beserta
              semua data terkait (produk, order, dll).
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-sm font-semibold rounded-xl transition-all"
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