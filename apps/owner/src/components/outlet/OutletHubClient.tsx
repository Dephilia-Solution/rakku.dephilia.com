"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { OwnerDashboardOutlet } from "@rakku/shared-types";
import { Tabs } from "@rakku/ui";
import {
  useOutletScope,
} from "@/components/outlet/OutletScopeProvider";
import OwnerEmployeesClient from "@/components/owner/OwnerEmployeesClient";
import ImportExcelPanel from "@/components/outlet/ImportExcelPanel";
import { MerchantLink as Link, useRouter, useSearchParams, useMerchantRequest, useMerchantRuntime, useMerchantToast } from "@/lib/merchant-runtime";
import { usePlan } from "@/components/billing/PlanProvider";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Package,
  Grid3X3,
  Users,
  X,
  Check,
  Power,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";

/** Pusat kelola satu pintu: daftar outlet (kartu) + Tim & Hak Akses. */
export default function OutletHubClient() {
  const request = useMerchantRequest();
  const showToast = useMerchantToast();
  const isActive = useMerchantRuntime()?.active;
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "tim" ? "tim" : "outlet";
  const { openUpgrade } = usePlan();
  const { outlets, refreshOutlets, setActiveOutletId } = useOutletScope();

  const [showForm, setShowForm] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<OwnerDashboardOutlet | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OwnerDashboardOutlet | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [teamRevision, setTeamRevision] = useState(0);
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

  const openCreateForm = () => {
    setEditingOutlet(null);
    setFormName("");
    setFormAddress("");
    setShowForm(true);
  };

  const openEditForm = (outlet: OwnerDashboardOutlet) => {
    setEditingOutlet(outlet);
    setFormName(outlet.name);
    setFormAddress(outlet.address || "");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isActive?.() === false) return;
    if (!formName.trim()) {
      showToast("error", "Nama outlet harus diisi");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingOutlet) {
        const res = await request(`/api/owner/outlets/${editingOutlet.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            address: formAddress.trim(),
          }),
        });
        const data = await res.json();
        if (isActive?.() === false) return;
        if (!res.ok) {
          showToast("error", data.error || "Gagal mengupdate outlet");
          return;
        }
        showToast("success", "Outlet berhasil diupdate");
      } else {
        const res = await request("/api/owner/outlets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            address: formAddress.trim(),
          }),
        });
        const data = await res.json();
        if (isActive?.() === false) return;
        if (!res.ok) {
          if (data.code === "PLAN_LIMIT") {
            setShowForm(false);
            openUpgrade(data.error);
          } else {
            showToast("error", data.error || "Gagal membuat outlet");
          }
          return;
        }
        showToast("success", "Outlet berhasil dibuat");
      }
      setShowForm(false);
      void refreshOutlets();
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (outlet: OwnerDashboardOutlet) => {
    if (isActive?.() === false) return;
    try {
      const res = await request(`/api/owner/outlets/${outlet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggle_status: true }),
      });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) {
        showToast("error", data.error || "Gagal mengubah status");
        return;
      }
      showToast(
        "success",
        `Outlet ${data.status === "active" ? "diaktifkan" : "dinonaktifkan"}`
      );
      void refreshOutlets();
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Terjadi kesalahan");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isActive?.() === false) return;
    try {
      const res = await request(`/api/owner/outlets/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) {
        showToast("error", data.error || "Gagal menghapus outlet");
        return;
      }
      showToast("success", "Outlet berhasil dihapus");
      setDeleteTarget(null);
      void refreshOutlets();
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Terjadi kesalahan");
    }
  };

  const setTab = (key: string) => {
    setShowImport(false);
    if (key === "outlet") router.replace("/outlets");
    else router.replace("/outlets?tab=tim");
  };

  const outletTabContent = (
    <>
      {outlets.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-12 text-center">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={32} className="text-on-surface-variant" />
          </div>
          <h3 className="font-bold text-on-surface mb-1">Belum ada outlet</h3>
          <p className="text-sm text-on-surface-variant mb-4">
            Tambahkan outlet pertama Anda untuk mulai berjualan, kelola menunya,
            dan bagi hak akses karyawan.
          </p>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all"
          >
            <Plus size={16} />
            Tambah Outlet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {outlets.map((outlet) => (
            <div
              key={outlet.id}
              className="bg-surface-container-lowest rounded-2xl border border-surface-container p-4 md:p-5 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">
                      {outlet.name}
                    </p>
                    <span
                      className={`mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                        outlet.status === "active"
                          ? "bg-success/10 text-success"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {outlet.status === "active" ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                </div>
              </div>

              {outlet.address ? (
                <p className="text-xs text-on-surface-variant flex items-start gap-1.5 -mt-1">
                  <MapPin size={14} className="flex-shrink-0 mt-0.5" strokeWidth={1.8} />
                  <span className="line-clamp-2">{outlet.address}</span>
                </p>
              ) : (
                <p className="text-xs text-on-surface-variant/50 italic flex items-start gap-1.5 -mt-1">
                  <MapPin size={14} className="flex-shrink-0 mt-0.5" strokeWidth={1.8} />
                  <span>Tanpa alamat</span>
                </p>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="min-h-[62px] bg-surface-container rounded-xl px-2 py-2 text-center flex flex-col items-center justify-center">
                  <p className="font-mono text-lg font-bold text-on-surface leading-none">
                    {outlet.products_count ?? 0}
                  </p>
                  <p className="text-[10px] text-on-surface-variant mt-1 flex items-center justify-center gap-1.5 leading-none">
                    <Package size={14} strokeWidth={1.8} aria-hidden="true" />
                    <span>Produk</span>
                  </p>
                </div>
                <div className="min-h-[62px] bg-surface-container rounded-xl px-2 py-2 text-center flex flex-col items-center justify-center">
                  <p className="font-mono text-lg font-bold text-on-surface leading-none">
                    {outlet.tables_count ?? 0}
                  </p>
                  <p className="text-[10px] text-on-surface-variant mt-1 flex items-center justify-center gap-1.5 leading-none">
                    <Grid3X3 size={14} strokeWidth={1.8} aria-hidden="true" />
                    <span>Meja</span>
                  </p>
                </div>
                <div className="min-h-[62px] bg-surface-container rounded-xl px-2 py-2 text-center flex flex-col items-center justify-center">
                  <p className="font-mono text-lg font-bold text-on-surface leading-none">
                    {outlet.employee_count}
                  </p>
                  <p className="text-[10px] text-on-surface-variant mt-1 flex items-center justify-center gap-1.5 leading-none">
                    <Users size={14} strokeWidth={1.8} aria-hidden="true" />
                    <span>Staf</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_44px_44px_44px] gap-2">
                <Link
                  href={`/outlets/${outlet.id}?tab=produk`}
                  onClick={() => setActiveOutletId(outlet.id)}
                  className="min-h-11 whitespace-nowrap inline-flex items-center justify-center gap-1.5 px-2 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all"
                >
                  Kelola Outlet
                  <ArrowUpRight size={14} />
                </Link>
                <button
                  onClick={() => openEditForm(outlet)}
                  aria-label={`Edit ${outlet.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  title="Edit nama & alamat"
                >
                  <Pencil size={17} strokeWidth={1.8} />
                </button>
                <button
                  onClick={() => handleToggleStatus(outlet)}
                  aria-label={outlet.status === "active" ? `Nonaktifkan ${outlet.name}` : `Aktifkan ${outlet.name}`}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${outlet.status === "active" ? "bg-surface-container text-on-surface-variant hover:bg-surface-container-high" : "bg-success/10 text-success hover:bg-success/15"}`}
                  title={outlet.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                >
                  {outlet.status === "active" ? <Power size={17} strokeWidth={1.8} /> : <Check size={18} strokeWidth={2} />}
                </button>
                <button
                  onClick={() => setDeleteTarget(outlet)}
                  aria-label={`Hapus ${outlet.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-error/5 text-error transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2"
                  title="Hapus"
                >
                  <Trash2 size={17} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal — rendered via portal ke document.body */}
      {showForm && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-surface-container-lowest rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-md max-h-[90dvh] overflow-hidden flex flex-col animate-slide-up pb-4 md:animate-bounce-in">
            <div className="flex items-center justify-between p-6 border-b border-surface-container bg-surface-container-lowest">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-on-surface">
                    {editingOutlet ? "Edit Outlet" : "Tambah Outlet"}
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    {editingOutlet ? "Ubah data outlet." : "Buat outlet baru untuk bisnis Anda."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={isSubmitting}
                className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 pb-[env(safe-area-inset-bottom,0px)]">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Nama Outlet
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Outlet Utama"
                  required
                  className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-base text-on-surface placeholder-neutral-400 outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Alamat{" "}
                  <span className="text-on-surface-variant normal-case font-normal">(opsional)</span>
                </label>
                <textarea
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Jl. Contoh No. 1, Jakarta"
                  rows={3}
                  className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-base text-on-surface placeholder-neutral-400 outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2 sticky bottom-0 bg-surface-container-lowest">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={isSubmitting}
                  className="px-5 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
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
          <div className="bg-surface-container-lowest rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 animate-slide-up pb-4 md:animate-bounce-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-danger/10 rounded-xl flex items-center justify-center text-error">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-on-surface">
                  Hapus Outlet?
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Tindakan ini tidak bisa dibatalkan.
                </p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">
              Anda akan menghapus outlet{" "}
              <span className="font-bold">{deleteTarget.name}</span> beserta
              semua data terkait (produk, order, dll).
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
    </>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-display-title text-on-surface">Outlet</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Satu pintu kelola semua cabang: menu, meja, pajak, dan tim.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 md:px-6 py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
          >
            <Plus size={16} />
            Tambah Outlet
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          active={activeTab}
          onChange={(k) => setTab(k)}
          tabs={[
            { key: "outlet", label: "Daftar Outlet", count: outlets.length },
            { key: "tim", label: "Tim & Hak Akses" },
          ]}
        />
        {activeTab === "tim" && (
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-container text-on-surface-variant text-sm font-semibold rounded-lg hover:bg-surface-container-high transition-all self-start sm:self-auto"
          >
            Import Karyawan
          </button>
        )}
      </div>

      {activeTab === "tim" ? (
        <>
          {showImport && (
            <div className="mt-5">
              <ImportExcelPanel
                domain="employees"
                onClose={() => setShowImport(false)}
                onImported={() => {
                  setShowImport(false);
                  setTeamRevision(value => value + 1);
                  void refreshOutlets();
                }}
              />
            </div>
          )}
          <OwnerEmployeesClient key={teamRevision} embedded />
        </>
      ) : (
        outletTabContent
      )}
    </div>
  );
}
