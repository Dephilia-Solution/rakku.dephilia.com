"use client";

import { useEffect, useState } from "react";
import { showToast } from "@rakku/ui";
import { Plus, Pencil, X, Check, Search } from "lucide-react";

interface Company {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
}

interface Outlet {
  id: string;
  name: string;
}

interface User {
  id: string;
  company_id: string;
  role_id: string;
  name: string;
  username: string;
  status: string;
  all_outlets: boolean;
  roles: { name: string } | null;
  companies: { name: string } | null;
}

export default function UsersPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", username: "", role_id: "", pin: "", all_outlets: false, outlet_ids: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/superadmin/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        if (data.length > 0) setSelectedCompany(data[0].id);
      })
      .catch(() => showToast("error", "Gagal memuat perusahaan"));
  }, []);

  useEffect(() => {
    if (!selectedCompany) return;
    Promise.all([
      fetch(`/api/superadmin/users?company_id=${selectedCompany}`).then((r) => r.json()),
      fetch(`/api/superadmin/roles?company_id=${selectedCompany}`).then((r) => r.json()),
      fetch("/api/superadmin/outlets").then((r) => r.json()),
    ])
      .then(([usersData, rolesData, outletsData]) => {
        setUsers(usersData);
        setRoles(rolesData);
        setOutlets(outletsData.filter((o: Outlet & { company_id: string }) => o.company_id === selectedCompany));
      })
      .catch(() => showToast("error", "Gagal memuat data"));
  }, [selectedCompany]);

  const handleSave = async () => {
    if (!form.name || !form.username || (!editing && !form.pin) || !form.role_id) {
      showToast("error", "Data belum lengkap");
      return;
    }
    setSaving(true);

    try {
      if (editing) {
        const res = await fetch(`/api/superadmin/users?id=${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch("/api/superadmin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, company_id: selectedCompany }),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      showToast("success", editing ? "User diupdate" : "User dibuat");
      setShowForm(false);
      setEditing(null);
      setForm({ name: "", username: "", role_id: "", pin: "", all_outlets: false, outlet_ids: [] });
      const data = await fetch(`/api/superadmin/users?company_id=${selectedCompany}`).then((r) => r.json());
      setUsers(data);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menyimpan");
    }
    setSaving(false);
  };

  const handleEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, username: u.username, role_id: u.role_id, pin: "", all_outlets: u.all_outlets, outlet_ids: [] });
    setShowForm(true);
  };

  const toggleOutlet = (outletId: string) => {
    setForm((prev) => ({
      ...prev,
      outlet_ids: prev.outlet_ids.includes(outletId)
        ? prev.outlet_ids.filter((id) => id !== outletId)
        : [...prev.outlet_ids, outletId],
    }));
  };

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-neutral-900">Users</h1>
        <div className="flex items-center gap-3">
          <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}
            className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest">
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={() => { setEditing(null); setForm({ name: "", username: "", role_id: roles[0]?.id || "", pin: "", all_outlets: false, outlet_ids: [] }); setShowForm(true); }}
            className="bg-forest text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark flex items-center gap-2">
            <Plus size={16} /> Tambah
          </button>
        </div>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input type="text" placeholder="Cari user..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Nama</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Username</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Role</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3 text-sm font-medium text-neutral-900">{u.name}</td>
                <td className="px-4 py-3 text-sm text-neutral-500 font-mono">{u.username}</td>
                <td className="px-4 py-3 text-sm text-neutral-600">{u.roles?.name ?? "-"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${u.status === "active" ? "bg-primary-100 text-forest" : "bg-neutral-100 text-neutral-500"}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleEdit(u)} className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500">
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-base">{editing ? "Edit User" : "Tambah User"}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Nama</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Budi Santoso" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Username</label>
                <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="budi" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Role</label>
                <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest">
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  PIN {editing ? "(kosongkan jika tidak diganti)" : ""}
                </label>
                <input type="password" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })}
                  placeholder="123456" maxLength={6}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-forest" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="all_outlets" checked={form.all_outlets}
                  onChange={(e) => setForm({ ...form, all_outlets: e.target.checked, outlet_ids: e.target.checked ? [] : form.outlet_ids })}
                  className="w-4 h-4 rounded border-neutral-300 text-forest focus:ring-forest" />
                <label htmlFor="all_outlets" className="text-sm text-neutral-700">Semua Outlet</label>
              </div>
              {!form.all_outlets && outlets.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Akses Outlet</label>
                  <div className="space-y-1.5">
                    {outlets.map((o) => (
                      <label key={o.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.outlet_ids.includes(o.id)}
                          onChange={() => toggleOutlet(o.id)}
                          className="w-4 h-4 rounded border-neutral-300 text-forest focus:ring-forest" />
                        <span className="text-sm text-neutral-700">{o.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowForm(false); setEditing(null); }}
                  className="flex-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl py-2.5 hover:bg-neutral-200">Batal</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-forest text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-forest-dark disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={16} />}
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
