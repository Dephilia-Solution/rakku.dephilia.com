"use client";

import { useEffect, useState } from "react";
import { showToast } from "@rakku/ui";
import { Plus, Pencil, X, Check, Trash2 } from "lucide-react";

interface MenuItem {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  path: string;
  sort_order: number;
}

export default function MenusPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({ slug: "", name: "", icon: "", path: "", sort_order: "0" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      const res = await fetch("/api/superadmin/menus");
      const data = await res.json();
      setMenus(data);
    } catch {
      showToast("error", "Gagal memuat data");
    }
  };

  const handleSave = async () => {
    if (!form.slug || !form.name || !form.path) {
      showToast("error", "Slug, nama, dan path harus diisi");
      return;
    }
    setSaving(true);

    try {
      const body = { ...form, sort_order: Number(form.sort_order) };

      if (editing) {
        const res = await fetch(`/api/superadmin/menus?id=${editing.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch("/api/superadmin/menus", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      showToast("success", editing ? "Menu diupdate" : "Menu dibuat");
      setShowForm(false);
      setEditing(null);
      setForm({ slug: "", name: "", icon: "", path: "", sort_order: "0" });
      fetchMenus();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menyimpan");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus menu ini?")) return;
    try {
      const res = await fetch(`/api/superadmin/menus?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      showToast("success", "Menu dihapus");
      fetchMenus();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-neutral-900">Menus</h1>
        <button onClick={() => { setEditing(null); setForm({ slug: "", name: "", icon: "", path: "", sort_order: "0" }); setShowForm(true); }}
          className="bg-forest text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark flex items-center gap-2">
          <Plus size={16} /> Tambah
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Urutan</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Slug</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Nama</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Path</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {menus.map((m) => (
              <tr key={m.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3 text-sm text-neutral-400">{m.sort_order}</td>
                <td className="px-4 py-3 font-mono text-sm font-semibold text-neutral-900">{m.slug}</td>
                <td className="px-4 py-3 text-sm text-neutral-900">{m.name}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{m.path}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(m); setForm({ slug: m.slug, name: m.name, icon: m.icon || "", path: m.path, sort_order: String(m.sort_order) }); setShowForm(true); }}
                      className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(m.id)}
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
              <h3 className="font-display font-semibold text-base">{editing ? "Edit Menu" : "Tambah Menu"}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Slug</label>
                  <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="orders" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Sort Order</label>
                  <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Nama</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Orders" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Path</label>
                <input type="text" value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })}
                  placeholder="/orders" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Icon (Lucide name)</label>
                <input type="text" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="ClipboardList" className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest" />
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
