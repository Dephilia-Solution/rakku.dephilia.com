"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/shared/Toast";
import { Plus, Pencil, X, Check, Search } from "lucide-react";

interface Outlet {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  status: string;
  companies: { name: string } | null;
}

interface Company {
  id: string;
  name: string;
  code: string;
}

export default function OutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [form, setForm] = useState({ company_id: "", name: "", address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/superadmin/outlets").then((r) => r.json()),
      fetch("/api/superadmin/companies").then((r) => r.json()),
    ]).then(([outletData, companyData]) => {
      setOutlets(outletData);
      setCompanies(companyData);
    }).catch(() => {
      showToast("error", "Gagal memuat data");
    });
  }, []);

  const handleSave = async () => {
    if (!form.name || !form.company_id) {
      showToast("error", "Nama dan perusahaan harus diisi");
      return;
    }
    setSaving(true);

    try {
      if (editing) {
        const res = await fetch(`/api/superadmin/outlets?id=${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch("/api/superadmin/outlets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      showToast("success", editing ? "Outlet diupdate" : "Outlet dibuat");
      setShowForm(false);
      setEditing(null);
      setForm({ company_id: "", name: "", address: "" });
      const data = await fetch("/api/superadmin/outlets").then((r) => r.json());
      setOutlets(data);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menyimpan");
    }
    setSaving(false);
  };

  const handleEdit = (o: Outlet) => {
    setEditing(o);
    setForm({ company_id: o.company_id, name: o.name, address: o.address || "" });
    setShowForm(true);
  };

  const filtered = outlets.filter((o) => {
    if (companyFilter !== "all" && o.company_id !== companyFilter) return false;
    if (search && !o.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-neutral-900">Outlets</h1>
        <button
          onClick={() => {
            setEditing(null);
            setForm({ company_id: companies[0]?.id || "", name: "", address: "" });
            setShowForm(true);
          }}
          className="bg-forest text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark flex items-center gap-2"
        >
          <Plus size={16} /> Tambah
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input type="text" placeholder="Cari outlet..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
        </div>
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}
          className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest">
          <option value="all">Semua Company</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Nama</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Perusahaan</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-neutral-900">{o.name}</p>
                  {o.address && <p className="text-xs text-neutral-400">{o.address}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-neutral-600">{o.companies?.name ?? "-"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${o.status === "active" ? "bg-primary-100 text-forest" : "bg-neutral-100 text-neutral-500"}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleEdit(o)} className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500">
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
              <h3 className="font-display font-semibold text-base">{editing ? "Edit Outlet" : "Tambah Outlet"}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Perusahaan</label>
                <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest">
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Nama Outlet</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Outlet Utama" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Alamat</label>
                <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2} className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest resize-none" />
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
