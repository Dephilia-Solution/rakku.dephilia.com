"use client";

import { useState, useEffect, useCallback } from "react";
import { MerchantLink as Link, useMerchantRequest, useMerchantRuntime, useMerchantToast } from "@/lib/merchant-runtime";
import { ArrowUpRight, Store, Shield, Loader2 } from "lucide-react";

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

interface Props {
  outletId: string;
  outletName: string;
}

/** Tab staf dari workspace outlet: siapa saja yang ditugaskan di outlet ini. */
export default function OutletStaffSection({ outletId, outletName }: Props) {
  const request = useMerchantRequest();
  const showToast = useMerchantToast();
  const isActive = useMerchantRuntime()?.active;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted || isActive?.() === false) return;
    setIsLoading(true);
    try {
      const res = await request("/api/owner/employees", { signal });
      const data = await res.json();
      if (signal?.aborted || isActive?.() === false) return;
      if (res.ok) {
        setEmployees(data.employees || []);
      }
    } catch {
      if (signal?.aborted || isActive?.() === false) return;
      showToast("error", "Gagal memuat data karyawan");
    } finally {
      if (!signal?.aborted && isActive?.() !== false) setIsLoading(false);
    }
  }, [request, showToast, isActive]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const assigned = employees.filter(
    (emp) => emp.all_outlets || emp.outlets.some((o) => o.id === outletId)
  );
  const activeCount = assigned.filter((e) => e.status === "active").length;

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Staf Outlet</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {activeCount} karyawan aktif ditugaskan di {outletName}.
          </p>
        </div>
        <Link
          href="/outlets?tab=tim"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface-container text-on-surface-variant text-xs font-semibold rounded-lg hover:bg-surface-container-high transition-all"
        >
          Kelola Tim
          <ArrowUpRight size={14} />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-on-surface-variant">
          <Loader2 size={26} className="animate-spin" />
        </div>
      ) : assigned.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-12 text-center">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store size={30} className="text-on-surface-variant" />
          </div>
          <h3 className="font-bold text-on-surface mb-1">
            Belum ada staf di outlet ini
          </h3>
          <p className="text-sm text-on-surface-variant mb-4">
            Tambahkan karyawan lalu tentukan penugasannya ke outlet ini.
          </p>
          <Link
            href="/outlets?tab=tim"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all"
          >
            <ArrowUpRight size={15} />
            Ke Tim & Hak Akses
          </Link>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-container">
                  {["Karyawan", "Role", "Penugasan", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-label-caps uppercase text-on-surface-variant px-6 py-3.5"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {assigned.map((emp) => (
                  <tr key={emp.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-on-surface">
                            {emp.name}
                          </p>
                          <p className="text-xs text-on-surface-variant">@{emp.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-sm text-on-surface-variant flex items-center gap-1.5">
                        <Shield size={14} />
                        {emp.role_name}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
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
                    <td className="px-6 py-3.5">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-surface-container">
            {assigned.map((emp) => (
              <div key={emp.id} className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{emp.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {emp.role_name} · {emp.all_outlets ? "Semua Outlet" : emp.outlets.map((o) => o.name).join(", ") || "-"}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                    emp.status === "active"
                      ? "bg-success/10 text-success"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {emp.status === "active" ? "Aktif" : "Nonaktif"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
