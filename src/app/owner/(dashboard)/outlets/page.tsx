"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  X,
  Users,
  AlertCircle,
} from "lucide-react";
import { showToast } from "@/components/shared/Toast";
import ToastContainer from "@/components/shared/Toast";

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
        // Update
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
        // Create
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {outlets.map((outlet) => (
            <div
              key={outlet.id}
              className="bg-white rounded-2xl border border-neutral-200 p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 bg-forest/10 rounded-xl flex items-center justify-center text-forest">
                  <Building2 size={20} />
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
              <h3 className="font-bold text-neutral-900 mb-1">{outlet.name}</h3>
              {outlet.address ? (
                <p className="text-sm text-neutral-400 flex items-start gap-1.5 mb-3">
                  <MapPin size={14} className="flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{outlet.address}</span>
                </p>
              ) : (
                <p className="text-sm text-neutral-300 italic mb-3">
                  Tanpa alamat
                </p>
              )}
              <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-4">
                <Users size={14} />
                {outlet.employee_count} karyawan
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
                <button
                  onClick={() => openEditForm(outlet)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-50 text-neutral-600 text-xs font-semibold rounded-lg hover:bg-neutral-100 transition-all"
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  onClick={() => handleToggleStatus(outlet)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-50 text-neutral-600 text-xs font-semibold rounded-lg hover:bg-neutral-100 transition-all"
                >
                  {outlet.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button
                  onClick={() => setDeleteTarget(outlet)}
                  className="inline-flex items-center justify-center px-3 py-2 bg-neutral-50 text-danger text-xs font-semibold rounded-lg hover:bg-danger/5 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h2 className="font-bold text-lg text-neutral-900">
                {editingOutlet ? "Edit Outlet" : "Tambah Outlet"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Nama Outlet
                </label>
                <div className="relative group">
                  <Building2
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-forest transition-colors"
                  />
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Outlet Utama"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent rounded-xl text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Alamat{" "}
                  <span className="text-neutral-400 normal-case font-normal">
                    (opsional)
                  </span>
                </label>
                <div className="relative group">
                  <MapPin
                    size={20}
                    className="absolute left-4 top-3 text-neutral-400 group-focus-within:text-forest transition-colors"
                  />
                  <textarea
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Jl. Contoh No. 1, Jakarta"
                    rows={3}
                    className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent rounded-xl text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-forest focus:ring-1 focus:ring-forest transition-all resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
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
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
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
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
