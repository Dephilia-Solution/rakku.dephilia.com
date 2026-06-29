"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/shared/Toast";
import { Plus, Pencil, X, Check, Trash2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
}

interface Role {
  id: string;
  company_id: string;
  name: string;
}

export default function RolesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [name, setName] = useState("");
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
    fetch(`/api/superadmin/roles?company_id=${selectedCompany}`)
      .then((r) => r.json())
      .then(setRoles)
      .catch(() => showToast("error", "Gagal memuat role"));
  }, [selectedCompany]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    try {
      if (editing) {
        const res = await fetch(`/api/superadmin/roles?id=${editing.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch("/api/superadmin/roles", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_id: selectedCompany, name: name.trim() }),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      showToast("success", editing ? "Role diupdate" : "Role dibuat");
      setShowForm(false);
      setEditing(null);
      setName("");
      const data = await fetch(`/api/superadmin/roles?company_id=${selectedCompany}`).then((r) => r.json());
      setRoles(data);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menyimpan");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus role ini?")) return;
    try {
      const res = await fetch(`/api/superadmin/roles?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      showToast("success", "Role dihapus");
      setRoles((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-neutral-900">Roles</h1>
        <div className="flex items-center gap-3">
          <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}
            className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest">
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={() => { setEditing(null); setName(""); setShowForm(true); }}
            className="bg-forest text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark flex items-center gap-2">
            <Plus size={16} /> Tambah
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Nama Role</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3 text-sm font-medium text-neutral-900">{r.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(r); setName(r.name); setShowForm(true); }}
                      className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(r.id)}
                      className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-base">{editing ? "Edit Role" : "Tambah Role"}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Nama Role</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Kepala Cabang" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
              </div>
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
