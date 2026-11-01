"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { RoleGrant } from "@rakku/db/roles-access";
import { createPortal } from "react-dom";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Key,
  X,
  AlertCircle,
  Check,
  Store,
  Shield,
} from "lucide-react";
import { Tabs } from "@rakku/ui";
import { useMerchantRequest, useMerchantRuntime, useMerchantToast } from "@/lib/merchant-runtime";
import { usePlan } from "@/components/billing/PlanProvider";

interface Employee {
  id: string;
  name: string;
  username: string;
  role_id: string;
  role_name: string;
  all_outlets: boolean;
  status: "active" | "inactive";
  avatar_url: string | null;
  outlets: { id: string; name: string }[];
  created_at: string;
}

interface Role {
  id: string;
  name: string;
}

interface RoleWithAccess extends Role {
  menu_access: string[];
  grants: RoleGrant[];
  revision: string;
}

function emptyGrant(menu_id: string): RoleGrant {
  return { menu_id, can_view: false, can_create: false, can_edit: false, can_delete: false };
}

interface Menu {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  path: string;
  sort_order: number;
}

interface Outlet {
  id: string;
  name: string;
  status: string;
}

export default function OwnerEmployeesPage({ embedded = false }: {
  embedded?: boolean;
}) {
  const request = useMerchantRequest();
  const showToast = useMerchantToast();
  const merchantRuntime = useMerchantRuntime();
  const isActive = merchantRuntime?.active;
  const { hasFeature, openUpgrade } = usePlan();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formRoleId, setFormRoleId] = useState("");
  const [formAllOutlets, setFormAllOutlets] = useState(false);
  const [formOutletIds, setFormOutletIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset PIN state
  const [newPin, setNewPin] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Tab state: karyawan list vs role & akses management
  const [activeTab, setActiveTab] = useState<"karyawan" | "role">("karyawan");

  // Role management state
  const [rolesWithAccess, setRolesWithAccess] = useState<RoleWithAccess[]>([]);
  const [menusList, setMenusList] = useState<Menu[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleFormName, setRoleFormName] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);
  const [deletingRole, setDeletingRole] = useState<RoleWithAccess | null>(null);
  const [grantDrafts, setGrantDrafts] = useState<Record<string, RoleGrant[]>>({});
  const [isSavingGrants, setIsSavingGrants] = useState(false);
  const grantSaveLock = useRef(false);
  const [grantError, setGrantError] = useState("");
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted || isActive?.() === false) return;
    setIsLoading(true);
    try {
      const res = await request("/api/owner/employees", { signal });
      const data = await res.json();
      if (signal?.aborted || isActive?.() === false) return;
      if (res.ok) {
        setEmployees(data.employees || []);
        setRoles(data.roles || []);
        setOutlets(data.outlets || []);
      }
    } catch {
      if (signal?.aborted || isActive?.() === false) return;
      showToast("error", "Gagal memuat data karyawan");
    } finally {
      if (!signal?.aborted && isActive?.() !== false) setIsLoading(false);
    }
  }, [request, showToast, isActive]);

  const fetchRolesData = useCallback(async () => {
    if (isActive?.() === false) return;
    try {
      const res = await request("/api/owner/roles");
      const data = await res.json();
      if (isActive?.() === false) return;
      if (res.ok) {
        const roles: RoleWithAccess[] = data.roles || [];
        setRolesWithAccess(roles);
        setGrantDrafts({});
        setGrantError("");
        setMenusList(data.menus || []);
        // Sinkronkan dropdown role di form karyawan
        setRoles(roles.map((r) => ({ id: r.id, name: r.name })));
        // Pertahankan seleksi role yang masih ada
        setSelectedRoleId((prev) =>
          prev && roles.some((r) => r.id === prev) ? prev : (roles[0]?.id ?? null)
        );
      } else showToast("error", data.error || "Gagal memuat data role");
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Gagal memuat data role");
    }
  }, [request, showToast, isActive]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const openCreateForm = () => {
    if (roles.length === 0) {
      showToast(
        "info",
        "Belum ada role. Buat role dulu di tab Role & Akses sebelum menambah karyawan."
      );
      setActiveTab("role");
      void fetchRolesData();
      return;
    }
    setEditingEmployee(null);
    setFormName("");
    setFormUsername("");
    setFormPin("");
    setFormRoleId(roles[0]?.id || "");
    setFormAllOutlets(false);
    setFormOutletIds([]);
    setShowForm(true);
  };

  const openEditForm = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormName(emp.name);
    setFormUsername(emp.username);
    setFormPin("");
    setFormRoleId(emp.role_id);
    setFormAllOutlets(emp.all_outlets);
    setFormOutletIds(emp.outlets.map((o) => o.id));
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isActive?.() === false) return;

    if (!formName.trim() || !formUsername.trim() || !formRoleId) {
      showToast("error", "Nama, username, dan role harus diisi");
      return;
    }

    if (!editingEmployee && !/^\d{6}$/.test(formPin)) {
      showToast("error", "PIN harus 6 digit angka");
      return;
    }

    if (!formAllOutlets && formOutletIds.length === 0) {
      showToast("error", "Pilih minimal 1 outlet");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingEmployee) {
        const res = await request(
          `/api/owner/employees/${editingEmployee.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: formName.trim(),
              username: formUsername.trim(),
              roleId: formRoleId,
              allOutlets: formAllOutlets,
              outletIds: formOutletIds,
            }),
          }
        );
        const data = await res.json();
        if (isActive?.() === false) return;
        if (!res.ok) {
          showToast("error", data.error || "Gagal mengupdate karyawan");
          return;
        }
        showToast("success", "Karyawan berhasil diupdate");
      } else {
        const res = await request("/api/owner/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            username: formUsername.trim(),
            pin: formPin,
            roleId: formRoleId,
            allOutlets: formAllOutlets,
            outletIds: formOutletIds,
          }),
        });
        const data = await res.json();
        if (isActive?.() === false) return;
        if (!res.ok) {
          showToast("error", data.error || "Gagal membuat karyawan");
          return;
        }
        showToast("success", "Karyawan berhasil dibuat");
      }
      setShowForm(false);
      fetchData();
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (emp: Employee) => {
    if (isActive?.() === false) return;
    try {
      const res = await request(`/api/owner/employees/${emp.id}`, {
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
        `Karyawan ${data.status === "active" ? "diaktifkan" : "dinonaktifkan"}`
      );
      fetchData();
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Terjadi kesalahan");
    }
  };

  const handleResetPin = async () => {
    if (!resetTarget || isActive?.() === false) return;
    if (!/^\d{6}$/.test(newPin)) {
      showToast("error", "PIN baru harus 6 digit angka");
      return;
    }

    setIsResetting(true);
    try {
      const res = await request(`/api/owner/employees/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset_pin: true, new_pin: newPin }),
      });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) {
        showToast("error", data.error || "Gagal reset PIN");
        setIsResetting(false);
        return;
      }
      showToast("success", "PIN berhasil direset");
      setResetTarget(null);
      setNewPin("");
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Terjadi kesalahan");
    } finally {
      if (isActive?.() !== false) setIsResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || isActive?.() === false) return;
    try {
      const res = await request(`/api/owner/employees/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) {
        showToast("error", data.error || "Gagal menghapus karyawan");
        return;
      }
      showToast("success", "Karyawan berhasil dihapus");
      setDeleteTarget(null);
      fetchData();
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Terjadi kesalahan");
    }
  };

  const toggleOutlet = (outletId: string) => {
    setFormOutletIds((prev) =>
      prev.includes(outletId)
        ? prev.filter((id) => id !== outletId)
        : [...prev, outletId]
    );
  };

  // ============================================================
  // ROLE HANDLERS
  // ============================================================
  const handleTabChange = (key: string) => {
    const next = key as "karyawan" | "role";
    setActiveTab(next);
    if (next === "role" && rolesWithAccess.length === 0) void fetchRolesData();
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isActive?.() === false) return;
    if (!roleFormName.trim()) {
      showToast("error", "Nama role harus diisi");
      return;
    }
    setIsRoleSubmitting(true);
    try {
      if (editingRoleId) {
        const res = await request(`/api/owner/roles/${editingRoleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: roleFormName.trim() }),
        });
        const data = await res.json();
        if (isActive?.() === false) return;
        if (!res.ok) {
          showToast("error", data.error || "Gagal mengupdate role");
          setIsRoleSubmitting(false);
          return;
        }
        showToast("success", "Role diupdate");
      } else {
        const res = await request("/api/owner/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: roleFormName.trim() }),
        });
        const data = await res.json();
        if (isActive?.() === false) return;
        if (!res.ok) {
          showToast("error", data.error || "Gagal membuat role");
          setIsRoleSubmitting(false);
          return;
        }
        showToast("success", "Role dibuat");
        setSelectedRoleId(data.role?.id ?? null);
      }
      setEditingRoleId(null);
      setRoleFormName("");
      setShowRoleForm(false);
      await fetchRolesData();
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Terjadi kesalahan");
    } finally {
      if (isActive?.() !== false) setIsRoleSubmitting(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deletingRole || isActive?.() === false) return;
    try {
      const res = await request(`/api/owner/roles/${deletingRole.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) {
        showToast("error", data.error || "Gagal menghapus role");
        setDeletingRole(null);
        return;
      }
      showToast("success", "Role dihapus");
      if (selectedRoleId === deletingRole.id) setSelectedRoleId(null);
      setDeletingRole(null);
      await fetchRolesData();
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Terjadi kesalahan");
    }
  };

  const menuDescriptions: Record<string, string> = {
    register: "Mencatat transaksi penjualan dan pemesanan",
    orders: "Melihat daftar pesanan masuk dan riwayat transaksi",
    reports: "Mengakses laporan keuangan dan analisis bisnis",
    products: "Mengelola produk, kategori, dan tier harga",
    "tax-discounts": "Mengatur pajak, promo, dan diskon",
  };

  const handleDraftGrant = (
    roleId: string,
    menuId: string,
    checked: boolean
  ) => {
    if (isActive?.() === false || grantSaveLock.current) return;
    if (!hasFeature("custom_roles")) {
      openUpgrade(
        "Mengatur akses menu role tersedia di paket Pro. Paket Free memakai role bawaan."
      );
      return;
    }
    const role = rolesWithAccess.find(r => r.id === roleId);
    if (!role) return;
    setGrantDrafts(prev => {
      const grants = prev[roleId] ?? role.grants;
      const next: RoleGrant = {
        menu_id: menuId,
        can_view: checked,
        can_create: checked,
        can_edit: checked,
        can_delete: checked,
      };
      return { ...prev, [roleId]: [...grants.filter(g => g.menu_id !== menuId), next] };
    });
    setGrantError("");
  };

  const handleSaveGrants = async () => {
    if (!selectedRoleId || grantSaveLock.current || isActive?.() === false) return;
    const role = rolesWithAccess.find(r => r.id === selectedRoleId);
    const grants = grantDrafts[selectedRoleId];
    if (!role || !grants) return;
    if (grants.some(g => [g.can_view, g.can_create, g.can_edit, g.can_delete].some(flag => flag !== g.can_view))) {
      setGrantError("Setiap menu hanya bisa memiliki akses penuh atau tanpa akses. Ubah checkbox lalu simpan kembali.");
      return;
    }
    grantSaveLock.current = true;
    setIsSavingGrants(true);
    setGrantError("");
    try {
      const res = await request(`/api/owner/roles/${role.id}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grants, expectedRevision: role.revision }),
      });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) {
        setGrantError(res.status === 409
          ? "Konflik: akses telah berubah. Muat ulang akses lalu tinjau dan terapkan kembali perubahan Anda."
          : data.error || "Gagal menyimpan akses");
        return;
      }
      setRolesWithAccess(prev => prev.map(r => r.id === role.id ? { ...r, grants: data.grants,
        revision: data.revision, menu_access: (data.grants as RoleGrant[]).filter(g => g.can_view).map(g => g.menu_id) } : r));
      setGrantDrafts(prev => { const next = { ...prev }; delete next[role.id]; return next; });
      showToast("success", data.revision === role.revision
        ? "Akses sudah sesuai; tidak ada perubahan."
        : merchantRuntime
          ? "Akses tersimpan. Perubahan berlaku saat akun POS login kembali."
          : "Akses tersimpan. Sesi POS role yang berubah telah dicabut.");
    } catch {
      if (isActive?.() === false) return;
      setGrantError("Gagal menyimpan akses. Muat ulang untuk memeriksa hasil sebelum mencoba kembali.");
    } finally {
      grantSaveLock.current = false;
      if (isActive?.() !== false) setIsSavingGrants(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {!embedded && (
          <div>
            <h1 className="font-display text-display-title text-on-surface">Karyawan</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Kelola akun karyawan dan hak aksesnya.
            </p>
          </div>
          )}
          <div className="flex items-center gap-2">
            {activeTab === "karyawan" ? (
            <button
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 px-4 md:px-6 py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              <Plus size={16} />
              Tambah Karyawan
            </button>
          ) : (
            <button
              onClick={() => {
                if (!hasFeature("custom_roles")) {
                  openUpgrade(
                    "Role custom & access matrix tersedia di paket Pro. Paket Free memakai role bawaan Owner dan Kasir."
                  );
                  return;
                }
                setEditingRoleId(null);
                setRoleFormName("");
                setShowRoleForm(true);
              }}
              className="inline-flex items-center gap-2 px-4 md:px-6 py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              <Plus size={16} />
              Tambah Role
            </button>
          )}
          </div>
        </div>

      <Tabs
        active={activeTab}
        onChange={handleTabChange}
        tabs={[
          { key: "karyawan", label: "Karyawan", count: employees.length },
          { key: "role", label: "Role & Akses", count: roles.length },
        ]}
      />

      {/* List */}
      {activeTab === "karyawan" && (isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-surface-container-lowest rounded-2xl border border-surface-container animate-pulse"
            />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-12 text-center">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={32} className="text-on-surface-variant" />
          </div>
          <h3 className="font-bold text-on-surface mb-1">
            Belum ada karyawan
          </h3>
          <p className="text-sm text-on-surface-variant mb-4">
            Tambahkan karyawan pertama untuk mulai berjualan di POS.
          </p>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all"
          >
            <Plus size={16} />
            Tambah Karyawan
          </button>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container-low border-b border-surface-container">
                <tr>
                  <th className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-6 py-3">
                    Nama
                  </th>
                  <th className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-6 py-3">
                    Role
                  </th>
                  <th className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-6 py-3">
                    Outlet
                  </th>
                  <th className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-6 py-3">
                    Status
                  </th>
                  <th className="text-right text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-6 py-3">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-surface-container-low">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-on-surface">
                            {emp.name}
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            @{emp.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-on-surface-variant">
                        {emp.role_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {emp.all_outlets ? (
                        <span className="text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded-full">
                          Semua Outlet
                        </span>
                      ) : (
                        <span className="text-sm text-on-surface-variant">
                          {emp.outlets.map((o) => o.name).join(", ") || "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          emp.status === "active"
                            ? "bg-success/10 text-success"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        {emp.status === "active" ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditForm(emp)}
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-all"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setResetTarget(emp)}
                          className="p-2 text-on-surface-variant hover:text-warning hover:bg-surface-container rounded-lg transition-all"
                          title="Reset PIN"
                        >
                          <Key size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(emp)}
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-all"
                          title={
                            emp.status === "active"
                              ? "Nonaktifkan"
                              : "Aktifkan"
                          }
                        >
                          {emp.status === "active" ? (
                            <X size={16} />
                          ) : (
                            <Check size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(emp)}
                          className="p-2 text-on-surface-variant hover:text-error hover:bg-surface-container rounded-lg transition-all"
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-surface-container">
            {employees.map((emp) => (
              <div key={emp.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {emp.name}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        @{emp.username}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      emp.status === "active"
                        ? "bg-success/10 text-success"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {emp.status === "active" ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <div className="space-y-1 mb-3">
                  <p className="text-xs text-on-surface-variant">
                    Role:{" "}
                    <span className="text-on-surface-variant font-semibold">
                      {emp.role_name}
                    </span>
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Outlet:{" "}
                    <span className="text-on-surface-variant">
                      {emp.all_outlets
                        ? "Semua Outlet"
                        : emp.outlets.map((o) => o.name).join(", ") || "-"}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditForm(emp)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-container-low text-on-surface-variant text-xs font-semibold rounded-lg"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    onClick={() => setResetTarget(emp)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-container-low text-warning text-xs font-semibold rounded-lg"
                  >
                    <Key size={14} /> PIN
                  </button>
                  <button
                    onClick={() => setDeleteTarget(emp)}
                    className="px-3 py-2 bg-surface-container-low text-error text-xs font-semibold rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Form Modal */}
      {showForm && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-surface-container-lowest rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-md max-h-[90dvh] overflow-hidden flex flex-col animate-slide-up pb-4 md:animate-bounce-in">
            <div className="flex items-center justify-between p-6 border-b border-surface-container bg-surface-container-lowest">
              <h2 className="font-bold text-lg text-on-surface">
                {editingEmployee ? "Edit Karyawan" : "Tambah Karyawan"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={isSubmitting}
                className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 overflow-y-auto flex-1 pb-[env(safe-area-inset-bottom,0px)]"
            >
              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Nama Karyawan
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Budi Santoso"
                  required
                  className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-base text-on-surface placeholder-neutral-400 outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Username
                </label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) =>
                    setFormUsername(e.target.value.toLowerCase())
                  }
                  placeholder="budi"
                  required
                  className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-base text-on-surface placeholder-neutral-400 outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-all lowercase"
                />
                <p className="text-xs text-on-surface-variant">
                  Dipakai untuk login kasir di step &quot;pilih akun&quot;.
                </p>
              </div>

              {!editingEmployee && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    PIN (6 digit)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={formPin}
                    onChange={(e) =>
                      setFormPin(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="123456"
                    required
                    className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-base text-on-surface placeholder-neutral-400 outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono tracking-widest"
                  />
                  <p className="text-xs text-on-surface-variant">
                    Beritahu PIN ini ke karyawan secara manual.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Role
                </label>
                <select
                  value={formRoleId}
                  onChange={(e) => setFormRoleId(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-base text-on-surface outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Akses Outlet
                </label>
                <label className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl cursor-pointer hover:bg-surface-container">
                  <input
                    type="checkbox"
                    checked={formAllOutlets}
                    onChange={(e) => setFormAllOutlets(e.target.checked)}
                    className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <div className="flex items-center gap-2">
                    <Store size={16} className="text-on-surface-variant" />
                    <span className="text-sm font-medium text-on-surface">
                      Semua Outlet (akses penuh)
                    </span>
                  </div>
                </label>

                {!formAllOutlets && (
                  <div className="space-y-2 max-h-40 overflow-y-auto p-2 border border-surface-container rounded-xl">
                    {outlets.map((o) => (
                      <label
                        key={o.id}
                        className="flex items-center gap-3 p-2 hover:bg-surface-container-low rounded-lg cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formOutletIds.includes(o.id)}
                          onChange={() => toggleOutlet(o.id)}
                          className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-on-surface">
                          {o.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
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
                  ) : editingEmployee ? (
                    "Simpan Perubahan"
                  ) : (
                    "Tambah Karyawan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Reset PIN Modal */}
      {resetTarget && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-surface-container-lowest rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 animate-slide-up pb-4 md:animate-bounce-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center text-warning">
                <Key size={24} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-on-surface">
                  Reset PIN
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Untuk karyawan: {resetTarget.name}
                </p>
              </div>
            </div>
            <div className="space-y-2 mb-6">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                PIN Baru (6 digit)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-base text-on-surface outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono tracking-widest"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setResetTarget(null);
                  setNewPin("");
                }}
                className="flex-1 px-5 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-sm font-semibold rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleResetPin}
                disabled={isResetting}
                className="flex-1 px-5 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isResetting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Reset PIN"
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation */}
      {deleteTarget && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-surface-container-lowest rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 animate-slide-up pb-4 md:animate-bounce-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-danger/10 rounded-xl flex items-center justify-center text-error">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-on-surface">
                  Hapus Karyawan?
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Tindakan ini tidak bisa dibatalkan.
                </p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">
              Anda akan menghapus karyawan{" "}
              <span className="font-bold">{deleteTarget.name}</span> (@
              {deleteTarget.username}).
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

      {/* Role & Akses Tab */}
      {activeTab === "role" && (
        <div className="space-y-5">
          {rolesWithAccess.length === 0 ? (
            <div className="text-center py-12 px-4 bg-surface-container-lowest rounded-xl">
              <Shield size={32} className="text-on-surface-variant/50 mx-auto mb-3" />
              <p className="text-sm text-on-surface-variant">Belum ada role. Klik &quot;Tambah Role&quot; untuk membuat role pertama.</p>
            </div>
          ) : (
            <>
                <div className="overflow-hidden bg-surface-container-lowest rounded-xl">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-surface-container">
                        <th className="text-left text-label-caps uppercase text-on-surface-variant px-4 py-3">Nama Role</th>
                        <th className="text-left text-label-caps uppercase text-on-surface-variant px-4 py-3">Hak Akses</th>
                        <th className="text-right text-label-caps uppercase text-on-surface-variant px-4 py-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      {rolesWithAccess.map((role) => (
                        <tr
                          key={role.id}
                          className={`hover:bg-surface-container-low/50 cursor-pointer transition-colors ${selectedRoleId === role.id ? "bg-primary/5" : ""}`}
                           onClick={() => { if (!grantSaveLock.current) { setSelectedRoleId(role.id); setGrantError(""); } }}
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <Shield size={16} className="text-on-surface-variant shrink-0" />
                              <span className="text-sm font-semibold text-on-surface">{role.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-on-surface-variant">{role.menu_access.length} menu</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  if (!hasFeature("custom_roles")) {
                                    openUpgrade("Role custom tersedia di paket Pro.");
                                    return;
                                  }
                                  setEditingRoleId(role.id);
                                  setRoleFormName(role.name);
                                  setShowRoleForm(true);
                                }}
                                className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-all"
                                title="Edit role"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  if (!hasFeature("custom_roles")) {
                                    openUpgrade("Role custom tersedia di paket Pro.");
                                    return;
                                  }
                                  setDeletingRole(role);
                                }}
                                className="p-2 text-error hover:bg-error-container/20 rounded-full transition-all"
                                title="Hapus role"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              {selectedRoleId && (
                <div className="bg-surface-container-lowest rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-on-surface">Atur Akses Menu</h3>
                    <span className="text-xs text-on-surface-variant">Satu centang memberikan akses penuh pada menu.</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-3">Centang memberikan izin melihat, menambah, mengubah, dan menghapus. Kosongkan untuk menutup seluruh akses menu. Perubahan disimpan sekaligus; pengguna POS pada role ini perlu login kembali setelah akses berubah.</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[320px]">
                      <thead><tr className="bg-surface-container-low">
                        <th className="text-left text-xs px-3 py-3">Menu</th>
                        <th scope="col" className="text-center text-xs px-3 py-3">Akses penuh</th>
                      </tr></thead>
                      <tbody>{menusList.map(menu => {
                        const role = rolesWithAccess.find(r => r.id === selectedRoleId);
                        const grants = grantDrafts[selectedRoleId] ?? role?.grants ?? [];
                        const grant = grants.find(g => g.menu_id === menu.id) ?? emptyGrant(menu.id);
                        return <tr key={menu.id} className="border-b border-surface-container">
                          <td className="px-3 py-3">
                            <p className="text-sm font-medium text-on-surface">{menu.name}</p>
                            <p className="text-xs text-on-surface-variant">{menuDescriptions[menu.slug] || `Akses menu ${menu.path}`}</p>
                          </td>
                          <td className="text-center">
                            <label className="inline-flex items-center justify-center min-h-11 min-w-11">
                              <input type="checkbox" checked={grant.can_view} disabled={isSavingGrants}
                                aria-label={`${menu.name}: akses penuh`}
                                onChange={e => handleDraftGrant(selectedRoleId, menu.id, e.target.checked)}
                                className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
                            </label>
                          </td>
                        </tr>;
                      })}</tbody>
                    </table>
                  </div>
                  {grantError && <p role="alert" className="text-sm text-error mt-3">{grantError}</p>}
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <button type="button" onClick={() => void handleSaveGrants()} disabled={isSavingGrants || !grantDrafts[selectedRoleId]}
                      className="px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-semibold disabled:opacity-50">
                      {isSavingGrants ? "Menyimpan…" : "Simpan Akses"}
                    </button>
                    <button type="button" onClick={() => void fetchRolesData()} disabled={isSavingGrants}
                      className="px-4 py-2.5 bg-surface-container rounded-lg text-sm disabled:opacity-50">Muat ulang akses (buang draf)</button>
                    {grantDrafts[selectedRoleId] && <span className="text-xs text-on-surface-variant">Ada perubahan belum disimpan</span>}
                  </div>
                  {menusList.length === 0 && (
                    <p className="text-sm text-on-surface-variant text-center py-8">Tidak ada menu terdaftar.</p>
                  )}
                </div>
              )}

              {!selectedRoleId && rolesWithAccess.length > 0 && (
                <div className="text-center py-6 bg-surface-container-lowest rounded-xl">
                  <p className="text-sm text-on-surface-variant">Klik salah satu role di tabel untuk mengatur akses menunya.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add/Edit Role Form Modal */}
      {showRoleForm && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-surface-container-lowest rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-sm p-6 animate-slide-up pb-4 md:animate-bounce-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-on-surface">
                  {editingRoleId ? "Ubah Role" : "Tambah Role"}
                </h3>
                <p className="text-xs text-on-surface-variant">
                  {editingRoleId ? "Ubah nama role karyawan." : "Buat role baru untuk karyawan."}
                </p>
              </div>
            </div>
            <form onSubmit={handleRoleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Nama Role
                </label>
                <input
                  type="text"
                  value={roleFormName}
                  onChange={(e) => setRoleFormName(e.target.value)}
                  placeholder="contoh: Kasir, Koki, Admin"
                  className="w-full px-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-base text-on-surface placeholder-neutral-400 outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowRoleForm(false); setEditingRoleId(null); setRoleFormName(""); }}
                  className="flex-1 px-5 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-sm font-semibold rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isRoleSubmitting}
                  className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isRoleSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : editingRoleId ? (
                    "Simpan"
                  ) : (
                    "Tambah"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Role Confirmation */}
      {deletingRole && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-surface-container-lowest rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-md p-6 animate-slide-up pb-4 md:animate-bounce-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-danger/10 rounded-xl flex items-center justify-center text-error">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-on-surface">
                  Hapus Role?
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Tindakan ini tidak bisa dibatalkan.
                </p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">
              Anda akan menghapus role{" "}
              <span className="font-bold">{deletingRole.name}</span>. Role yang
              masih dipakai karyawan tidak bisa dihapus.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingRole(null)}
                className="flex-1 px-5 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-sm font-semibold rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteRole}
                className="flex-1 px-5 py-3 bg-danger hover:bg-danger/90 text-white text-sm font-semibold rounded-xl transition-all"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
