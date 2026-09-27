"use client";

import { useEffect, useState } from "react";
import { showToast } from "@rakku/ui";
import { Plus, Pencil, X, Check, Trash2 } from "lucide-react";

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_outlets: number;
  max_employees: number;
  max_products: number;
  max_ingredients: number;
  max_transactions_month: number;
  report_history_days: number;
  email_reports_month: number;
  storage_mb: number;
  features: Record<string, boolean>;
  is_active: boolean;
  sort_order: number;
}

const FEATURES: { key: string; label: string }[] = [
  { key: "multi_outlet", label: "Multi-outlet" },
  { key: "custom_roles", label: "Role custom" },
  { key: "profit_loss", label: "Laba rugi" },
  { key: "email_reports", label: "Email report" },
  { key: "inventory_advanced", label: "Inventory lanjutan" },
  { key: "remove_qr_branding", label: "Tanpa branding QR" },
  { key: "audit_log", label: "Audit log" },
  { key: "priority_support", label: "Prioritas support" },
];

const EMPTY_FORM: Omit<Plan, "id"> = {
  slug: "",
  name: "",
  description: "",
  price_monthly: 0,
  price_yearly: 0,
  max_outlets: 1,
  max_employees: 2,
  max_products: 30,
  max_ingredients: 10,
  max_transactions_month: 500,
  report_history_days: 30,
  email_reports_month: 5,
  storage_mb: 50,
  features: {},
  is_active: true,
  sort_order: 0,
};

function formatRupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<Omit<Plan, "id">>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/superadmin/plans");
      const data = await res.json();
      setPlans(Array.isArray(data) ? data : []);
    } catch {
      showToast("error", "Gagal memuat data plan");
    }
  };

  const handleSave = async () => {
    if (!form.slug || !form.name) {
      showToast("error", "Slug dan nama plan harus diisi");
      return;
    }
    setSaving(true);
    try {
      const res = editing
        ? await fetch(`/api/superadmin/plans?id=${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          })
        : await fetch("/api/superadmin/plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal menyimpan plan");
      }

      showToast("success", editing ? "Plan diupdate" : "Plan dibuat");
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      fetchPlans();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menyimpan");
    }
    setSaving(false);
  };

  const handleEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({ ...plan, features: plan.features ?? {} });
    setShowForm(true);
  };

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`Hapus plan "${plan.name}"?`)) return;
    try {
      const res = await fetch(`/api/superadmin/plans?id=${plan.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal menghapus plan");
      }
      showToast("success", "Plan dihapus");
      fetchPlans();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  const toggleFeature = (key: string) => {
    setForm((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features[key] },
    }));
  };

  const numberField = (
    label: string,
    key: keyof Omit<Plan, "id">,
    hint?: string
  ) => (
    <div>
      <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      <input
        type="number"
        value={Number(form[key])}
        onChange={(e) =>
          setForm({ ...form, [key]: Number(e.target.value) })
        }
        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
      />
      {hint ? (
        <p className="text-[11px] text-neutral-400 mt-1">{hint}</p>
      ) : null}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-neutral-900">
            Plans
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Paket langganan freemium & limit. Isi -1 untuk unlimited.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setForm(EMPTY_FORM);
            setShowForm(true);
          }}
          className="bg-forest text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark active:scale-[0.98] transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          Tambah
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Slug</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Nama</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Harga/bln</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Outlet</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Karyawan</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Produk</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Bahan</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Transaksi/bln</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3 font-mono text-sm font-bold text-neutral-900">{plan.slug}</td>
                <td className="px-4 py-3 text-sm text-neutral-900">{plan.name}</td>
                <td className="px-4 py-3 text-sm text-right">{formatRupiah(plan.price_monthly)}</td>
                <td className="px-4 py-3 text-sm text-right">{plan.max_outlets < 0 ? "∞" : plan.max_outlets}</td>
                <td className="px-4 py-3 text-sm text-right">{plan.max_employees < 0 ? "∞" : plan.max_employees}</td>
                <td className="px-4 py-3 text-sm text-right">{plan.max_products < 0 ? "∞" : plan.max_products}</td>
                <td className="px-4 py-3 text-sm text-right">{plan.max_ingredients < 0 ? "∞" : plan.max_ingredients}</td>
                <td className="px-4 py-3 text-sm text-right">{plan.max_transactions_month < 0 ? "∞" : plan.max_transactions_month}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${plan.is_active ? "bg-primary-100 text-forest" : "bg-neutral-100 text-neutral-500"}`}>
                    {plan.is_active ? "Active" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(plan)} className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(plan)} className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-red-50 flex items-center justify-center text-neutral-500 hover:text-danger">
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
          <div className="bg-white rounded-2xl shadow-md w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-base">
                {editing ? `Edit Plan: ${editing.name}` : "Tambah Plan"}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                  placeholder="pro"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Nama</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Pro"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">Deskripsi</label>
                <input
                  type="text"
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest"
                />
              </div>

              {numberField("Harga Bulanan (Rp)", "price_monthly")}
              {numberField("Harga Tahunan (Rp)", "price_yearly")}
              {numberField("Max Outlet", "max_outlets", "-1 = unlimited")}
              {numberField("Max Karyawan", "max_employees")}
              {numberField("Max Produk", "max_products")}
              {numberField("Max Bahan Baku", "max_ingredients")}
              {numberField("Max Transaksi/Bulan", "max_transactions_month")}
              {numberField("Riwayat Laporan (hari)", "report_history_days")}
              {numberField("Email Report/Bulan", "email_reports_month")}
              {numberField("Storage (MB)", "storage_mb")}
              {numberField("Urutan", "sort_order")}
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Fitur</p>
              <div className="grid grid-cols-2 gap-2">
                {FEATURES.map((feature) => (
                  <label key={feature.key} className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={Boolean(form.features?.[feature.key])}
                      onChange={() => toggleFeature(feature.key)}
                      className="accent-forest"
                    />
                    {feature.label}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-neutral-700 mt-4">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="accent-forest"
              />
              Plan aktif (bisa dipilih owner)
            </label>

            <div className="flex gap-3 pt-5">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="flex-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl py-2.5 hover:bg-neutral-200"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-forest text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-forest-dark disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
