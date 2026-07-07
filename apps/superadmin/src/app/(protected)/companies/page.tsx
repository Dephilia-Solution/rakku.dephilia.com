"use client";

import { useEffect, useState } from "react";
import { showToast } from "@rakku/ui";
import {
  Plus,
  Pencil,
  X,
  Check,
  Search,
} from "lucide-react";

interface Company {
  id: string;
  code: string;
  name: string;
  status: string;
  created_at: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({ code: "", name: "", password: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/superadmin/companies");
      const data = await res.json();
      setCompanies(data);
    } catch {
      showToast("error", "Gagal memuat data");
    }
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      showToast("error", "Kode dan nama perusahaan harus diisi");
      return;
    }
    if (!editing && !form.password) {
      showToast("error", "Password perusahaan harus diisi");
      return;
    }
    setSaving(true);

    try {
      if (editing) {
        const res = await fetch(`/api/superadmin/companies?id=${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch("/api/superadmin/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      showToast("success", editing ? "Perusahaan diupdate" : "Perusahaan dibuat");
      setShowForm(false);
      setEditing(null);
      setForm({ code: "", name: "", password: "" });
      fetchCompanies();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menyimpan");
    }
    setSaving(false);
  };

  const handleEdit = (c: Company) => {
    setEditing(c);
    setForm({ code: c.code, name: c.name, password: "" });
    setShowForm(true);
  };

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-neutral-900">Companies</h1>
        <button
          onClick={() => {
            setEditing(null);
            setForm({ code: "", name: "", password: "" });
            setShowForm(true);
          }}
          className="bg-forest text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark active:scale-[0.98] transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          Tambah
        </button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          placeholder="Cari perusahaan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-forest"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Kode</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Nama</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3 font-mono text-sm font-bold text-neutral-900">{c.code}</td>
                <td className="px-4 py-3 text-sm text-neutral-900">{c.name}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${c.status === "active" ? "bg-primary-100 text-forest" : "bg-neutral-100 text-neutral-500"}`}>
                    {c.status === "active" ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleEdit(c)} className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500">
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
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-base">{editing ? "Edit Perusahaan" : "Tambah Perusahaan"}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Kode Perusahaan</label>
                <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="KOPIKITA" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm uppercase focus:outline-none focus:border-forest" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Nama Perusahaan</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Kopi Kita Indonesia" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
                  Password {editing ? "(kosongkan jika tidak diganti)" : ""}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
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
