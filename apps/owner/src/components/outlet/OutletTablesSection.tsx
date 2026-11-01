"use client";

import { useState, useEffect, useCallback } from "react";
import { Grid3X3, Plus, Pencil, Trash2, Search } from "lucide-react";
import { useMerchantRequest, useMerchantRuntime, useMerchantToast } from "@/lib/merchant-runtime";
import { OwnerEmpty, OwnerError, OwnerSection, OwnerSkeleton } from "@/components/ui/OwnerPrimitives";
import OwnerSheet from "@/components/ui/OwnerSheet";
import { useOutletScope } from "./OutletScopeProvider";

interface DiningTable {
  id: string;
  company_id: string;
  outlet_id: string;
  name: string;
  status: "available" | "occupied";
  created_at: string;
  outlet_name?: string | null;
}
interface Props { outletId: string; outletName: string }
const inputClass = "w-full min-h-11 rounded-lg border border-surface-container bg-white px-3.5 py-3 text-base text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary";
const iconClass = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low active:bg-surface-container transition-colors disabled:opacity-50";

/** Tab meja dari workspace outlet: daftar meja + status kosong/terisi. */
export default function OutletTablesSection({ outletId, outletName }: Props) {
  const request = useMerchantRequest();
  const showToast = useMerchantToast();
  const isActive = useMerchantRuntime()?.active;
  const { refreshOutlets } = useOutletScope();
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [formName, setFormName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DiningTable | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchTables = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted || isActive?.() === false) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const url = outletId ? `/api/owner/tables?outlet_id=${encodeURIComponent(outletId)}` : "/api/owner/tables";
      const res = await request(url, { signal });
      const data = await res.json();
      if (signal?.aborted || isActive?.() === false) return;
      if (!res.ok) { setLoadError(data.error || "Gagal memuat data meja"); return; }
      setTables(data.tables ?? []);
    } catch {
      if (signal?.aborted || isActive?.() === false) return;
      setLoadError("Gagal memuat data meja. Periksa koneksi lalu coba lagi.");
    } finally {
      if (!signal?.aborted && isActive?.() !== false) setIsLoading(false);
    }
  }, [outletId, request, isActive]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchTables(controller.signal);
    return () => controller.abort();
  }, [fetchTables]);

  const filtered = tables.filter((table) => table.name.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID")));
  const availableCount = filtered.filter((table) => table.status === "available").length;
  const occupiedCount = filtered.length - availableCount;
  const openCreateForm = () => { setEditingTable(null); setFormName(""); setFormError(null); setShowForm(true); };
  const openEditForm = (table: DiningTable) => { setEditingTable(table); setFormName(table.name); setFormError(null); setShowForm(true); };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || isActive?.() === false) return;
    if (!formName.trim()) { setFormError("Nama meja harus diisi"); return; }
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await request("/api/owner/tables", {
        method: editingTable ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTable ? { id: editingTable.id, name: formName.trim() } : { name: formName.trim(), outlet_id: outletId }),
      });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) { setFormError(data.error || (editingTable ? "Gagal mengupdate meja" : "Gagal membuat meja")); return; }
      showToast("success", editingTable ? "Meja berhasil diupdate" : "Meja berhasil ditambahkan");
      setShowForm(false);
      void fetchTables();
      void refreshOutlets();
    } catch {
      if (isActive?.() === false) return;
      setFormError("Gagal menyimpan meja. Periksa koneksi lalu coba lagi.");
    } finally { setIsSubmitting(false); }
  };

  const handleToggleStatus = async (table: DiningTable) => {
    if (busyId || isActive?.() === false) return;
    const next = table.status === "available" ? "occupied" : "available";
    setBusyId(table.id);
    setMutationError(null);
    try {
      const res = await request("/api/owner/tables", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: table.id, status: next }),
      });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) { setMutationError(data.error || "Gagal mengubah status"); return; }
      showToast("success", next === "occupied" ? "Meja ditandai terisi" : "Meja tersedia kembali");
      void fetchTables();
    } catch {
      if (isActive?.() === false) return;
      setMutationError("Gagal mengubah status meja. Silakan coba lagi.");
    } finally { setBusyId(null); }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting || isActive?.() === false) return;
    setIsDeleting(true);
    setMutationError(null);
    try {
      const res = await request(`/api/owner/tables?id=${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) { setMutationError(data.error || "Gagal menghapus meja"); return; }
      showToast("success", "Meja berhasil dihapus");
      setDeleteTarget(null);
      void fetchTables();
      void refreshOutlets();
    } catch {
      if (isActive?.() === false) return;
      setMutationError("Gagal menghapus meja. Periksa koneksi lalu coba lagi.");
    } finally { setIsDeleting(false); }
  };

  const statusButton = (table: DiningTable) => <button type="button" disabled={!!busyId} onClick={() => void handleToggleStatus(table)} aria-label={`Ubah status ${table.name}: ${table.status === "available" ? "Tersedia" : "Terisi"}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold transition-colors hover:bg-surface-container-low disabled:opacity-50">
    <span className={`h-2 w-2 rounded-full ${table.status === "available" ? "bg-primary" : "bg-amber-500"}`} />
    {busyId === table.id ? "Menyimpan..." : table.status === "available" ? "Tersedia" : "Terisi"}
  </button>;
  const actions = (table: DiningTable) => <div className="flex items-center justify-end gap-2">
    <button type="button" onClick={() => openEditForm(table)} aria-label={`Edit ${table.name}`} title="Edit" className={iconClass}><Pencil size={17} /></button>
    <button type="button" onClick={() => { setMutationError(null); setDeleteTarget(table); }} aria-label={`Hapus ${table.name}`} title="Hapus" className={`${iconClass} text-error`}><Trash2 size={17} /></button>
  </div>;
  const addButton = <button type="button" onClick={openCreateForm} className="owner-button owner-button--primary"><Plus size={16} />Tambah Meja</button>;

  return <>
    <OwnerSection title="Meja" description={`Kelola meja dine-in dan ketersediaannya di ${outletName}.`} actions={addButton}>
      <div className="space-y-5">
        <div className="owner-toolbar">
          <div className="owner-search relative min-w-0"><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" /><input type="search" aria-label="Cari nama meja" placeholder="Cari nama meja..." value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-11`} /></div>
          <p className="text-xs text-on-surface-variant">Ketuk status untuk mengubah ketersediaan meja.</p>
        </div>
        {!isLoading && !loadError && <dl className="grid grid-cols-3 gap-3 rounded-xl border border-surface-container bg-surface-container-low/50 p-4">
          {[{ label: "Total", value: filtered.length, color: "text-on-surface" }, { label: "Tersedia", value: availableCount, color: "text-primary" }, { label: "Terisi", value: occupiedCount, color: "text-on-surface" }].map((stat) => <div key={stat.label}><dt className="text-xs text-on-surface-variant">{stat.label}</dt><dd className={`mt-1 text-2xl font-semibold tabular-nums ${stat.color}`}>{stat.value}</dd></div>)}
        </dl>}
        {mutationError && !deleteTarget && <OwnerError message={mutationError} />}
        {isLoading ? <OwnerSkeleton /> : loadError ? <OwnerError message={loadError} retry={() => void fetchTables()} /> : !filtered.length ? <OwnerEmpty title={tables.length ? "Meja tidak ditemukan" : "Belum ada meja"} description={tables.length ? "Coba nama lain atau hapus pencarian untuk melihat semua meja." : "Tambahkan meja untuk melayani pesanan dine-in di outlet ini."} action={tables.length ? <button type="button" onClick={() => setSearch("")} className="owner-button owner-button--secondary">Hapus pencarian</button> : addButton} /> : <>
          <div className="hidden overflow-hidden rounded-xl border border-surface-container lg:block">
            <table className="w-full text-sm"><caption className="sr-only">Daftar meja {outletName}</caption>
              <thead className="border-b border-surface-container bg-surface-container-low text-xs text-on-surface-variant"><tr><th scope="col" className="px-5 py-3 text-left font-semibold">Nama</th><th scope="col" className="px-5 py-3 text-left font-semibold">Status</th><th scope="col" className="px-5 py-3 text-right font-semibold">Aksi</th></tr></thead>
              <tbody className="divide-y divide-surface-container">{filtered.map((table) => <tr key={table.id} className="hover:bg-surface-container-low/50"><td className="break-words px-5 py-3 font-semibold text-on-surface">{table.name}</td><td className="px-5 py-3">{statusButton(table)}</td><td className="px-5 py-3">{actions(table)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">{filtered.map((table) => <article key={table.id} className="min-w-0 rounded-xl border border-surface-container p-4">
            <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Grid3X3 size={20} /></div><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold text-on-surface">{table.name}</h3>{statusButton(table)}</div></div>
            <div className="mt-3 border-t border-surface-container pt-2">{actions(table)}</div>
          </article>)}</div>
        </>}
      </div>
    </OwnerSection>

    <OwnerSheet open={showForm} onClose={() => setShowForm(false)} title={editingTable ? "Edit Meja" : "Tambah Meja"} subtitle={editingTable ? "Ubah nama meja." : `Buat meja baru untuk ${outletName}.`}
      footer={<div className="grid grid-cols-2 gap-3"><button type="button" disabled={isSubmitting} onClick={() => setShowForm(false)} className="owner-button owner-button--secondary">Batal</button><button type="submit" form="outlet-table-form" disabled={isSubmitting} className="owner-button owner-button--primary">{isSubmitting ? "Menyimpan..." : editingTable ? "Simpan Perubahan" : "Tambah Meja"}</button></div>}>
      <form id="outlet-table-form" onSubmit={handleSubmit} className="space-y-5">{formError && <OwnerError message={formError} />}<div className="space-y-2"><label htmlFor="outlet-table-name" className="block text-sm font-medium text-on-surface">Nama Meja</label><input id="outlet-table-name" required type="text" value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="Contoh: Meja 1" className={inputClass} /></div></form>
    </OwnerSheet>
    <OwnerSheet open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Meja?" subtitle="Tindakan ini tidak bisa dibatalkan."
      footer={<div className="grid grid-cols-2 gap-3"><button type="button" disabled={isDeleting} onClick={() => setDeleteTarget(null)} className="owner-button owner-button--secondary">Batal</button><button type="button" disabled={isDeleting} onClick={() => void handleDelete()} className="owner-button bg-error text-white hover:bg-error/90">{isDeleting ? "Menghapus..." : "Hapus"}</button></div>}>
      <div className="space-y-4">{mutationError && <OwnerError message={mutationError} />}<p className="text-sm leading-relaxed text-on-surface-variant">Anda akan menghapus meja <strong className="text-on-surface">{deleteTarget?.name}</strong> dari outlet <strong className="text-on-surface">{outletName}</strong>.</p></div>
    </OwnerSheet>
  </>;
}
