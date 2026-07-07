"use client";

import { useCallback, useEffect, useState } from "react";
import { showToast } from "@rakku/ui";

interface Company {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
}

interface Menu {
  id: string;
  slug: string;
  name: string;
}

interface Access {
  role_id: string;
  menu_id: string;
  can_view: boolean;
}

export default function AccessMatrixPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [access, setAccess] = useState<Access[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/superadmin/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        if (data.length > 0) setSelectedCompany(data[0].id);
      })
      .catch(() => showToast("error", "Gagal memuat perusahaan"));
  }, []);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/access-matrix?company_id=${selectedCompany}`);
      const data = await res.json();
      setRoles(data.roles ?? []);
      setMenus(data.menus ?? []);
      setAccess(data.access ?? []);
    } catch {
      showToast("error", "Gagal memuat matrix akses");
    }
    setLoading(false);
  }, [selectedCompany]);

  useEffect(() => {
    if (!selectedCompany) return;
    loadMatrix();
  }, [selectedCompany, loadMatrix]);

  const hasAccess = (roleId: string, menuId: string): boolean => {
    return access.some((a) => a.role_id === roleId && a.menu_id === menuId && a.can_view);
  };

  const handleToggle = async (roleId: string, menuId: string, currentValue: boolean) => {
    const key = `${roleId}-${menuId}`;
    setToggling((prev) => ({ ...prev, [key]: true }));

    try {
      const res = await fetch("/api/superadmin/access-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_id: roleId, menu_id: menuId, can_view: !currentValue }),
      });

      if (!res.ok) throw new Error(await res.text());

      if (currentValue) {
        setAccess((prev) => prev.filter((a) => !(a.role_id === roleId && a.menu_id === menuId)));
      } else {
        setAccess((prev) => [...prev, { role_id: roleId, menu_id: menuId, can_view: true }]);
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal update akses");
    }
    setToggling((prev) => ({ ...prev, [key]: false }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-neutral-900">Access Matrix</h1>
        <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}
          className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-forest">
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3 min-w-[150px]">
                  Role
                </th>
                {menus.map((m) => (
                  <th key={m.id} className="text-center text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3">
                    {m.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{role.name}</td>
                  {menus.map((menu) => {
                    const allowed = hasAccess(role.id, menu.id);
                    const key = `${role.id}-${menu.id}`;
                    const isToggling = toggling[key];

                    return (
                      <td key={menu.id} className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(role.id, menu.id, allowed)}
                          disabled={isToggling}
                          className={`w-7 h-7 rounded-md border-2 transition-all ${
                            allowed
                              ? "bg-forest border-forest text-white"
                              : "border-neutral-300 text-transparent hover:border-neutral-400"
                          } disabled:opacity-50`}
                        >
                          {isToggling ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                          ) : allowed ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4 mx-auto">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : null}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
