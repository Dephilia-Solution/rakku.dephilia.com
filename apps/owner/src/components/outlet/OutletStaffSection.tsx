"use client";

import { useState, useEffect, useCallback } from "react";
import { MerchantLink as Link, useMerchantRequest, useMerchantRuntime } from "@/lib/merchant-runtime";
import { OwnerEmpty, OwnerError, OwnerSection, OwnerSkeleton } from "@/components/ui/OwnerPrimitives";
import { ArrowUpRight, Shield, Search } from "lucide-react";

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
  const isActive = useMerchantRuntime()?.active;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted || isActive?.() === false) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await request("/api/owner/employees", { signal });
      const data = await res.json();
      if (signal?.aborted || isActive?.() === false) return;
      if (res.ok) {
        setEmployees(data.employees || []);
      } else {
        setLoadError(data.error || "Gagal memuat data karyawan");
      }
    } catch {
      if (signal?.aborted || isActive?.() === false) return;
      setLoadError("Gagal memuat data karyawan. Periksa koneksi lalu coba lagi.");
    } finally {
      if (!signal?.aborted && isActive?.() !== false) setIsLoading(false);
    }
  }, [request, isActive]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const assigned = employees.filter(
    (emp) => emp.all_outlets || emp.outlets.some((o) => o.id === outletId)
  );
  const activeCount = assigned.filter((e) => e.status === "active").length;
  const filtered = assigned.filter((employee) => `${employee.name} ${employee.username} ${employee.role_name}`.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID")));

  return (
    <OwnerSection title="Staf Outlet" description={`Karyawan dan hak akses yang ditugaskan di ${outletName}.`} actions={
        <Link
          href="/outlets?tab=tim"
          className="owner-button owner-button--secondary"
        >
          Kelola Tim
          <ArrowUpRight size={14} />
        </Link>
      }>
      <div className="owner-toolbar mb-5">
        <div className="owner-search relative min-w-0"><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" /><input type="search" aria-label="Cari staf outlet" placeholder="Cari nama, username, atau role..." value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 w-full rounded-lg border border-surface-container bg-white py-3 pl-11 pr-4 text-base text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary" /></div>
        {!isLoading && !loadError && <p className="text-xs text-on-surface-variant tabular-nums" aria-live="polite">{filtered.length} staf · {activeCount} aktif di outlet ini</p>}
      </div>

      {isLoading ? (
        <OwnerSkeleton />
      ) : loadError ? (
        <OwnerError message={loadError} retry={() => void fetchData()} />
      ) : filtered.length === 0 ? (
        <OwnerEmpty title={assigned.length ? "Staf tidak ditemukan" : "Belum ada staf di outlet ini"} description={assigned.length ? "Coba nama, username, atau role lain." : "Tambahkan karyawan lalu tentukan penugasannya ke outlet ini."}
          action={assigned.length ? <button type="button" onClick={() => setSearch("")} className="owner-button owner-button--secondary">Hapus pencarian</button> : <Link href="/outlets?tab=tim" className="owner-button owner-button--primary">Ke Tim & Hak Akses<ArrowUpRight size={15} /></Link>} />
      ) : (
        <div className="min-w-0">
          <div className="hidden lg:block rounded-xl border border-surface-container overflow-hidden">
            <table className="w-full">
              <caption className="sr-only">Staf yang ditugaskan di {outletName}</caption>
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-container">
                  {["Karyawan", "Role", "Penugasan", "Status"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="text-left text-xs font-semibold text-on-surface-variant px-5 py-3.5"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-semibold text-sm">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-on-surface break-words">
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

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:hidden">
            {filtered.map((emp) => (
              <article key={emp.id} className="min-w-0 rounded-xl border border-surface-container p-4">
                <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-on-surface break-words">{emp.name}</h3>
                  <p className="mt-0.5 text-xs text-on-surface-variant break-all">@{emp.username}</p>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-md ${
                    emp.status === "active"
                      ? "bg-success/10 text-success"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {emp.status === "active" ? "Aktif" : "Nonaktif"}
                </span>
                </div>
                <dl className="mt-4 space-y-3 border-t border-surface-container pt-3 text-sm"><div><dt className="text-xs text-on-surface-variant">Role</dt><dd className="mt-1 flex items-start gap-1.5 text-on-surface break-words"><Shield size={14} className="mt-0.5 shrink-0" />{emp.role_name}</dd></div><div><dt className="text-xs text-on-surface-variant">Penugasan</dt><dd className="mt-1 text-on-surface break-words">{emp.all_outlets ? "Semua Outlet" : emp.outlets.map((o) => o.name).join(", ") || "-"}</dd></div></dl>
              </article>
            ))}
          </div>
        </div>
      )}
    </OwnerSection>
  );
}
