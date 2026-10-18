"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { showToast } from "@rakku/ui";
import type { RoleGrant } from "@rakku/db/roles-access";

interface Company { id: string; name: string; }
interface Role { id: string; name: string; menu_access: string[]; grants: RoleGrant[]; revision: string; }
interface Menu { id: string; slug: string; name: string; }
const columns = [
  { key: "can_view", label: "V", title: "Lihat" },
  { key: "can_create", label: "C", title: "Tambah" },
  { key: "can_edit", label: "E", title: "Ubah" },
  { key: "can_delete", label: "D", title: "Hapus" },
] as const;
const emptyGrant = (menu_id: string): RoleGrant => ({ menu_id, can_view: false, can_create: false, can_edit: false, can_delete: false });

export default function AccessMatrixPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RoleGrant[]>>({});
  const [selectedCompany, setSelectedCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const saveLock = useRef(false);
  const loadVersion = useRef(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/superadmin/companies", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Gagal memuat perusahaan");
        const data: Company[] = await response.json();
        if (controller.signal.aborted) return;
        setCompanies(data);
        if (data.length) setSelectedCompany(data[0].id);
      }).catch(() => { if (!controller.signal.aborted) showToast("error", "Gagal memuat perusahaan"); });
    return () => controller.abort();
  }, []);

  const loadMatrix = useCallback(async (signal?: AbortSignal) => {
    if (!selectedCompany || saveLock.current) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/superadmin/access-matrix?company_id=${encodeURIComponent(selectedCompany)}`, { signal, cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat matrix akses");
      if (signal?.aborted || version !== loadVersion.current) return;
      setRoles(data.roles ?? []);
      setMenus(data.menus ?? []);
      setDrafts({});
    } catch (err) {
      if (!signal?.aborted && version === loadVersion.current) setError(err instanceof Error ? err.message : "Gagal memuat matrix akses");
    } finally {
      if (!signal?.aborted && version === loadVersion.current) setLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    const controller = new AbortController();
    void loadMatrix(controller.signal);
    return () => controller.abort();
  }, [loadMatrix]);

  const updateDraft = (role: Role, menuId: string, flag: typeof columns[number]["key"], checked: boolean) => {
    if (saveLock.current) return;
    setDrafts(prev => {
      const grants = prev[role.id] ?? role.grants;
      const grant = grants.find(g => g.menu_id === menuId) ?? emptyGrant(menuId);
      return { ...prev, [role.id]: [...grants.filter(g => g.menu_id !== menuId), { ...grant, [flag]: checked }] };
    });
    setError("");
  };

  const save = async (role: Role) => {
    const grants = drafts[role.id];
    if (!grants || saveLock.current) return;
    if (grants.some(g => !g.can_view && (g.can_create || g.can_edit || g.can_delete))) {
      setError("Create/edit/delete memerlukan V. Tinjau flag legacy: aktifkan V atau hapus flag secara eksplisit.");
      return;
    }
    saveLock.current = true;
    setSavingRole(role.id);
    setError("");
    try {
      const res = await fetch("/api/superadmin/access-matrix", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: selectedCompany, role_id: role.id, grants, expectedRevision: role.revision }) });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 409 ? "Konflik: akses berubah. Muat ulang lalu tinjau dan terapkan kembali perubahan Anda." : data.error || "Gagal menyimpan akses");
        return;
      }
      setRoles(prev => prev.map(r => r.id === role.id ? { ...r, grants: data.grants, revision: data.revision,
        menu_access: (data.grants as RoleGrant[]).filter(g => g.can_view).map(g => g.menu_id) } : r));
      setDrafts(prev => { const next = { ...prev }; delete next[role.id]; return next; });
      showToast("success", "Akses tersimpan. Sesi POS role yang berubah telah dicabut.");
    } catch {
      setError("Gagal menyimpan akses. Muat ulang untuk memeriksa hasil sebelum mencoba kembali.");
    } finally {
      saveLock.current = false;
      setSavingRole(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display font-bold text-2xl text-neutral-900">Access Matrix</h1>
        <select value={selectedCompany} disabled={!!savingRole} aria-label="Perusahaan"
          onChange={e => { ++loadVersion.current; setRoles([]); setDrafts({}); setError(""); setSelectedCompany(e.target.value); }}
          className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest">
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm text-neutral-500">V lihat · C tambah · E ubah · D hapus. Simpan sekaligus per role. Mutasi memerlukan V; V tidak memberi C/E/D otomatis.</p>
        <button type="button" disabled={!!savingRole || loading} onClick={() => void loadMatrix()}
          className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm disabled:opacity-50">Muat ulang (buang draf)</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700 mb-4">{error}</p>}
      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-forest/30 border-t-forest rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead><tr className="border-b border-neutral-200">
              <th scope="col" className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3 min-w-[170px]">Role</th>
              {menus.map(menu => <th key={menu.id} scope="col" className="text-center text-xs font-medium text-neutral-400 px-4 py-3 min-w-[192px]">
                {menu.name}<div className="grid grid-cols-4 mt-2">{columns.map(c => <span key={c.key} title={c.title}>{c.label}</span>)}</div>
              </th>)}
            </tr></thead>
            <tbody>{roles.map(role => <tr key={role.id} className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="px-4 py-3 text-sm font-medium text-neutral-900">
                <p>{role.name}</p>
                <button type="button" onClick={() => void save(role)} disabled={!!savingRole || !drafts[role.id]}
                  className="mt-2 px-3 py-2 bg-forest text-white rounded-lg text-xs disabled:opacity-50">
                  {savingRole === role.id ? "Menyimpan…" : "Simpan Akses"}
                </button>
                {drafts[role.id] && <p className="text-xs text-neutral-500 mt-1">Belum disimpan</p>}
              </td>
              {menus.map(menu => {
                const grant = (drafts[role.id] ?? role.grants).find(g => g.menu_id === menu.id) ?? emptyGrant(menu.id);
                const invalid = !grant.can_view && (grant.can_create || grant.can_edit || grant.can_delete);
                return <td key={menu.id} className="px-4 py-3 text-center">
                  <div className="grid grid-cols-4">{columns.map(column => <label key={column.key} className="inline-flex items-center justify-center min-w-11 min-h-11">
                    <input type="checkbox" checked={grant[column.key]} disabled={!!savingRole}
                      aria-label={`${role.name} / ${menu.name}: ${column.title}`}
                      onChange={e => updateDraft(role, menu.id, column.key, e.target.checked)} className="w-5 h-5 accent-forest" />
                  </label>)}</div>
                  {invalid && <p className="text-xs text-red-700">Flag legacy tanpa V: tinjau</p>}
                </td>;
              })}
            </tr>)}</tbody>
          </table>
          {!roles.length && <p className="px-4 py-8 text-sm text-neutral-500">Tidak ada role untuk perusahaan ini.</p>}
        </div>
      )}
    </div>
  );
}
