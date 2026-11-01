"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { OwnerDashboardOutlet } from "@rakku/shared-types";
import { useOutletScope } from "@/components/outlet/OutletScopeProvider";
import { OwnerEmpty, OwnerError, OwnerPageHeader, OwnerSection, OwnerSkeleton } from "@/components/ui/OwnerPrimitives";
import OwnerSheet from "@/components/ui/OwnerSheet";
import { MerchantLink as Link, useRouter, useSearchParams, useMerchantRequest, useMerchantRuntime, useMerchantToast } from "@/lib/merchant-runtime";
import { usePlan } from "@/components/billing/PlanProvider";
import { Building2, Plus, Pencil, Trash2, MapPin, Package, Grid3X3, Users, Check, Power, ArrowUpRight, Search, Upload } from "lucide-react";

const ImportExcelPanel = dynamic(() => import("./ImportExcelPanel"), { loading: () => <OwnerSkeleton rows={2} /> });
const OwnerEmployeesClient = dynamic(() => import("@/components/owner/OwnerEmployeesClient"), { loading: () => <OwnerSkeleton /> });
const inputClass = "min-h-11 w-full rounded-lg border border-surface-container bg-white px-3.5 py-3 text-base text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary";
const iconClass = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low active:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";

/** Pusat kelola satu pintu: daftar outlet + Tim & Hak Akses. */
export default function OutletHubClient() {
  const request = useMerchantRequest();
  const showToast = useMerchantToast();
  const isActive = useMerchantRuntime()?.active;
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "tim" ? "tim" : "outlet";
  const { openUpgrade } = usePlan();
  const { outlets, refreshOutlets, setActiveOutletId } = useOutletScope();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<OwnerDashboardOutlet | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OwnerDashboardOutlet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [teamRevision, setTeamRevision] = useState(0);

  const openCreateForm = () => {
    setEditingOutlet(null);
    setFormName("");
    setFormAddress("");
    setFormError(null);
    setShowForm(true);
  };
  const openEditForm = (outlet: OwnerDashboardOutlet) => {
    setEditingOutlet(outlet);
    setFormName(outlet.name);
    setFormAddress(outlet.address || "");
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || isActive?.() === false) return;
    if (!formName.trim()) { setFormError("Nama outlet harus diisi"); return; }
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await request(editingOutlet ? `/api/owner/outlets/${editingOutlet.id}` : "/api/owner/outlets", {
        method: editingOutlet ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), address: formAddress.trim() }),
      });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) {
        const message = data.error || (editingOutlet ? "Gagal mengupdate outlet" : "Gagal membuat outlet");
        if (!editingOutlet && data.code === "PLAN_LIMIT") { setShowForm(false); openUpgrade(message); }
        else { setFormError(message); showToast("error", message); }
        return;
      }
      showToast("success", editingOutlet ? "Outlet berhasil diupdate" : "Outlet berhasil dibuat");
      setShowForm(false);
      void refreshOutlets();
    } catch {
      if (isActive?.() === false) return;
      setFormError("Gagal menyimpan outlet. Periksa koneksi lalu coba lagi.");
    } finally { setIsSubmitting(false); }
  };

  const handleToggleStatus = async (outlet: OwnerDashboardOutlet) => {
    if (togglingId || isActive?.() === false) return;
    setTogglingId(outlet.id);
    try {
      const res = await request(`/api/owner/outlets/${outlet.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggle_status: true }),
      });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) { showToast("error", data.error || "Gagal mengubah status"); return; }
      showToast("success", `Outlet ${data.status === "active" ? "diaktifkan" : "dinonaktifkan"}`);
      void refreshOutlets();
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Gagal mengubah status outlet");
    } finally { setTogglingId(null); }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting || isActive?.() === false) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await request(`/api/owner/outlets/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) { setDeleteError(data.error || "Gagal menghapus outlet"); return; }
      showToast("success", "Outlet berhasil dihapus");
      setDeleteTarget(null);
      void refreshOutlets();
    } catch {
      if (isActive?.() === false) return;
      setDeleteError("Gagal menghapus outlet. Periksa koneksi lalu coba lagi.");
    } finally { setIsDeleting(false); }
  };

  const setTab = (key: string) => {
    setShowImport(false);
    router.replace(key === "outlet" ? "/outlets" : "/outlets?tab=tim");
  };
  const filtered = outlets.filter((outlet) => `${outlet.name} ${outlet.address ?? ""}`.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID")));
  const createButton = <button type="button" onClick={openCreateForm} className="owner-button owner-button--primary"><Plus size={16} />Tambah Outlet</button>;

  return <div className="min-w-0 space-y-5">
    <OwnerPageHeader title="Outlet" description="Kelola cabang, operasional outlet, dan akses tim Anda." actions={createButton} />
    <nav aria-label="Pengelolaan outlet" className="flex max-w-full gap-1 overflow-x-auto border-b border-surface-container">
      {[{ key: "outlet", label: "Daftar Outlet" }, { key: "tim", label: "Tim & Hak Akses" }].map(({ key, label }) => <button key={key} type="button" aria-current={activeTab === key ? "page" : undefined} onClick={() => setTab(key)}
        className={`min-h-12 shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === key ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}>
        {label}{key === "outlet" && <span className="ml-2 rounded-md bg-surface-container px-1.5 py-0.5 text-xs tabular-nums text-on-surface-variant">{outlets.length}</span>}
      </button>)}
    </nav>

    {activeTab === "tim" ? <div className="min-w-0 space-y-5">
      <div className="owner-toolbar justify-end"><button type="button" onClick={() => setShowImport(true)} className="owner-button owner-button--secondary"><Upload size={16} />Import Karyawan</button></div>
      {showImport && <ImportExcelPanel domain="employees" onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); setTeamRevision((value) => value + 1); void refreshOutlets(); }} />}
      <OwnerEmployeesClient key={teamRevision} embedded />
    </div> : <OwnerSection title="Daftar Outlet" description={`${outlets.length} outlet · Pilih outlet untuk mengelola produk, bahan baku, meja, dan pengaturannya.`}>
      <div className="owner-toolbar mb-5">
        <div className="owner-search relative min-w-0"><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input type="search" aria-label="Cari outlet" placeholder="Cari nama atau alamat outlet..." value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-11`} />
        </div>
        <p className="text-xs text-on-surface-variant tabular-nums" aria-live="polite">{filtered.length} outlet ditampilkan</p>
      </div>
      {!outlets.length ? <OwnerEmpty title="Belum ada outlet" description="Tambahkan outlet pertama Anda untuk mulai berjualan, kelola menunya, dan bagi hak akses karyawan." action={createButton} />
        : !filtered.length ? <OwnerEmpty title="Outlet tidak ditemukan" description="Coba nama atau alamat lain, atau hapus pencarian Anda." action={<button type="button" onClick={() => setSearch("")} className="owner-button owner-button--secondary">Hapus pencarian</button>} />
        : <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((outlet) => <article key={outlet.id} className="flex min-w-0 flex-col rounded-xl border border-surface-container bg-white">
          <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 size={20} /></div>
              <div className="min-w-0"><h3 className="break-words text-base font-semibold text-on-surface">{outlet.name}</h3>
                <span className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${outlet.status === "active" ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"}`}>{outlet.status === "active" ? "Aktif" : "Nonaktif"}</span>
              </div>
            </div>
            <p className="flex items-start gap-2 text-sm leading-relaxed text-on-surface-variant"><MapPin size={15} className="mt-0.5 shrink-0" /><span className="break-words">{outlet.address || "Tanpa alamat"}</span></p>
            <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-surface-container pt-4">
              {[{ label: "Produk", value: outlet.products_count ?? 0, Icon: Package }, { label: "Meja", value: outlet.tables_count ?? 0, Icon: Grid3X3 }, { label: "Staf", value: outlet.employee_count, Icon: Users }].map(({ label, value, Icon }) => <div key={label}><dt className="flex items-center gap-1.5 text-xs text-on-surface-variant"><Icon size={13} />{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-on-surface">{value}</dd></div>)}
            </dl>
          </div>
          <div className="flex flex-wrap items-center gap-1 border-t border-surface-container p-3">
            <Link href={`/outlets/${outlet.id}?tab=produk`} onClick={() => setActiveOutletId(outlet.id)} className="owner-button owner-button--quiet mr-auto">Kelola Outlet<ArrowUpRight size={15} /></Link>
            <button type="button" onClick={() => openEditForm(outlet)} aria-label={`Edit ${outlet.name}`} title="Edit nama & alamat" className={iconClass}><Pencil size={17} /></button>
            <button type="button" disabled={!!togglingId} onClick={() => void handleToggleStatus(outlet)} aria-label={`${outlet.status === "active" ? "Nonaktifkan" : "Aktifkan"} ${outlet.name}`} title={outlet.status === "active" ? "Nonaktifkan" : "Aktifkan"} className={iconClass}>{outlet.status === "active" ? <Power size={17} /> : <Check size={18} />}</button>
            <button type="button" onClick={() => { setDeleteError(null); setDeleteTarget(outlet); }} aria-label={`Hapus ${outlet.name}`} title="Hapus" className={`${iconClass} text-error`}><Trash2 size={17} /></button>
          </div>
        </article>)}</div>}
    </OwnerSection>}

    <OwnerSheet open={showForm} onClose={() => setShowForm(false)} title={editingOutlet ? "Edit Outlet" : "Tambah Outlet"} subtitle={editingOutlet ? "Ubah nama dan alamat outlet." : "Buat outlet baru untuk bisnis Anda."}
      footer={<div className="grid grid-cols-2 gap-3"><button type="button" disabled={isSubmitting} onClick={() => setShowForm(false)} className="owner-button owner-button--secondary">Batal</button><button type="submit" form="outlet-hub-form" disabled={isSubmitting} className="owner-button owner-button--primary">{isSubmitting ? "Menyimpan..." : editingOutlet ? "Simpan Perubahan" : "Tambah Outlet"}</button></div>}>
      <form id="outlet-hub-form" onSubmit={handleSubmit} className="space-y-5">
        {formError && <OwnerError message={formError} />}
        <div className="space-y-2"><label htmlFor="outlet-hub-name" className="block text-sm font-medium text-on-surface">Nama Outlet</label><input id="outlet-hub-name" type="text" required value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="Outlet Utama" className={inputClass} /></div>
        <div className="space-y-2"><label htmlFor="outlet-hub-address" className="block text-sm font-medium text-on-surface">Alamat <span className="font-normal text-on-surface-variant">(opsional)</span></label><textarea id="outlet-hub-address" rows={4} value={formAddress} onChange={(event) => setFormAddress(event.target.value)} placeholder="Jl. Contoh No. 1, Jakarta" className={`${inputClass} resize-y`} /></div>
      </form>
    </OwnerSheet>
    <OwnerSheet open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Outlet?" subtitle="Tindakan ini tidak bisa dibatalkan."
      footer={<div className="grid grid-cols-2 gap-3"><button type="button" disabled={isDeleting} onClick={() => setDeleteTarget(null)} className="owner-button owner-button--secondary">Batal</button><button type="button" disabled={isDeleting} onClick={() => void handleDelete()} className="owner-button bg-error text-white hover:bg-error/90">{isDeleting ? "Menghapus..." : "Hapus"}</button></div>}>
      <div className="space-y-4">{deleteError && <OwnerError message={deleteError} />}<p className="text-sm leading-relaxed text-on-surface-variant">Anda akan menghapus outlet <strong className="text-on-surface">{deleteTarget?.name}</strong> beserta semua data terkait (produk, order, dll).</p></div>
    </OwnerSheet>
  </div>;
}
