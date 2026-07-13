"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Store,
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  LogOut,
  ExternalLink,
  BarChart3,
  ClipboardList,
  Layers,
  DollarSign,
  Percent,
} from "lucide-react";

interface OwnerSidebarProps {
  owner: {
    name: string;
    email: string;
    companyName: string;
    companyCode: string;
  };
}

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/orders", label: "Pesanan", icon: ClipboardList },
  { href: "/outlets", label: "Outlet", icon: Building2 },
  { href: "/employees", label: "Karyawan", icon: Users },
  { href: "/pricing-tiers", label: "Pricing Tiers", icon: Layers },
  { href: "/taxes", label: "Tax", icon: DollarSign },
  { href: "/discounts", label: "Diskon", icon: Percent },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function OwnerSidebar({ owner }: OwnerSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-neutral-200 z-40 flex-col hidden md:flex"
      aria-label="Navigasi utama"
    >
      <div className="h-16 flex items-center gap-2 px-6 border-b border-neutral-200">
        <div className="w-8 h-8 bg-forest rounded-lg flex items-center justify-center text-white">
          <Store size={18} />
        </div>
        <span className="font-bold text-forest text-lg">Rakku</span>
      </div>

      <div className="px-4 py-4 border-b border-neutral-200">
        <div className="bg-neutral-50 rounded-xl p-3">
          <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold mb-1">
            Perusahaan
          </p>
          <p className="text-sm font-bold text-neutral-900 truncate">
            {owner.companyName}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            Kode: <span className="font-mono">{owner.companyCode}</span>
          </p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto scrollbar-none">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                active
                  ? "bg-forest text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}

        <div className="my-4 border-t border-neutral-200" />

        <a
          href={process.env.NEXT_PUBLIC_POS_URL || "http://localhost:3001"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-all active:scale-95"
        >
          <ExternalLink size={18} />
          Login Kasir
        </a>
      </nav>

      <div className="px-4 py-4 border-t border-neutral-200">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-9 h-9 bg-forest/10 rounded-full flex items-center justify-center text-forest font-bold text-sm">
            {owner.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-900 truncate">
              {owner.name}
            </p>
            <p className="text-xs text-neutral-400 truncate">{owner.email}</p>
          </div>
        </div>
        <form action="/api/auth/owner/logout" method="POST">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-danger hover:bg-danger/5 transition-all active:scale-95"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </form>
      </div>
    </aside>
  );
}
