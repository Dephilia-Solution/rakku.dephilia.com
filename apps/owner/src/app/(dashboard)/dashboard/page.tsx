import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import {
  getOwnerOutlets,
  getOwnerEmployees,
} from "@/lib/supabase/queries.owner";
import { createAdminClient } from "@rakku/supabase-clients";
import Link from "next/link";
import {
  Building2,
  Users,
  TrendingUp,
  ArrowRight,
  Store,
} from "lucide-react";

export default async function OwnerDashboardPage() {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) return null;

  const [outlets, employees] = await Promise.all([
    getOwnerOutlets(session.company_id),
    getOwnerEmployees(session.company_id),
  ]);

  const supabase = createAdminClient();
  const outletIds = outlets.map((o) => o.id);
  let totalRevenue = 0;
  let totalTransactions = 0;

  if (outletIds.length > 0) {
    const { data: orders } = await supabase
      .from("orders")
      .select("total_price, status")
      .eq("company_id", session.company_id)
      .in("outlet_id", outletIds)
      .eq("status", "completed");

    totalTransactions = orders?.length ?? 0;
    totalRevenue = (orders ?? []).reduce(
      (sum, o) => sum + Number(o.total_price || 0),
      0
    );
  }

  const activeOutlets = outlets.filter((o) => o.status === "active").length;
  const activeEmployees = employees.filter((e) => e.status === "active").length;

  const stats = [
    {
      label: "Total Outlet",
      value: String(outlets.length),
      sub: `${activeOutlets} aktif`,
      icon: Building2,
      color: "bg-forest",
      href: "/outlets",
    },
    {
      label: "Total Karyawan",
      value: String(employees.length),
      sub: `${activeEmployees} aktif`,
      icon: Users,
      color: "bg-blue-500",
      href: "/employees",
    },
    {
      label: "Total Penjualan",
      value: `Rp ${totalRevenue.toLocaleString("id-ID")}`,
      sub: `${totalTransactions} transaksi`,
      icon: TrendingUp,
      color: "bg-success",
      href: "#",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Halo, {session.name}!
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Berikut ringkasan bisnis Anda hari ini.
          </p>
        </div>
        
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white rounded-2xl border border-neutral-200 p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-11 h-11 ${stat.color} rounded-xl flex items-center justify-center text-white`}
                >
                  <Icon size={20} />
                </div>
                <ArrowRight size={16} className="text-neutral-300" />
              </div>
              <p className="text-sm text-neutral-400">{stat.label}</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                {stat.value}
              </p>
              <p className="text-xs text-neutral-400 mt-1">{stat.sub}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-forest/10 rounded-xl flex items-center justify-center text-forest">
              <Store size={20} />
            </div>
            <h2 className="font-bold text-neutral-900">Outlet Terbaru</h2>
          </div>
          <div className="space-y-2">
            {outlets.slice(0, 3).map((outlet) => (
              <div
                key={outlet.id}
                className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl"
              >
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    {outlet.name}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {outlet.employee_count} karyawan
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    outlet.status === "active"
                      ? "bg-success/10 text-success"
                      : "bg-neutral-200 text-neutral-400"
                  }`}
                >
                  {outlet.status === "active" ? "Aktif" : "Nonaktif"}
                </span>
              </div>
            ))}
            {outlets.length === 0 && (
              <p className="text-sm text-neutral-400 text-center py-4">
                Belum ada outlet
              </p>
            )}
          </div>
          <Link
            href="/outlets"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline"
          >
            Kelola outlet <ArrowRight size={14} />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-forest/10 rounded-xl flex items-center justify-center text-forest">
              <Users size={20} />
            </div>
            <h2 className="font-bold text-neutral-900">Karyawan Terbaru</h2>
          </div>
          <div className="space-y-2">
            {employees.slice(0, 3).map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-forest/10 rounded-full flex items-center justify-center text-forest font-bold text-xs">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {emp.name}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {emp.role_name}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    emp.status === "active"
                      ? "bg-success/10 text-success"
                      : "bg-neutral-200 text-neutral-400"
                  }`}
                >
                  {emp.status === "active" ? "Aktif" : "Nonaktif"}
                </span>
              </div>
            ))}
            {employees.length === 0 && (
              <p className="text-sm text-neutral-400 text-center py-4">
                Belum ada karyawan
              </p>
            )}
          </div>
          <Link
            href="/employees"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline"
          >
            Kelola karyawan <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      
    </div>
  );
}
