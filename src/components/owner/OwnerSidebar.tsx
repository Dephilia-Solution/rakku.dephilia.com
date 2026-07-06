"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Store,
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
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
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner/outlets", label: "Outlet", icon: Building2 },
  { href: "/owner/employees", label: "Karyawan", icon: Users },
  { href: "/owner/settings", label: "Pengaturan", icon: Settings },
];

export default function OwnerSidebar({ owner }: OwnerSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-neutral-200 z-40 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-forest rounded-lg flex items-center justify-center text-white">
            <Store size={18} />
          </div>
          <span className="font-bold text-forest">Rakku</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-neutral-200 z-50 flex flex-col transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-6 border-b border-neutral-200">
          <div className="w-8 h-8 bg-forest rounded-lg flex items-center justify-center text-white">
            <Store size={18} />
          </div>
          <span className="font-bold text-forest text-lg">Rakku</span>
        </div>

        {/* Company Info */}
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

        {/* Menu */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/owner"
                ? pathname === "/owner"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-forest text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="my-4 border-t border-neutral-200"></div>

          {/* Link ke POS Kasir */}
          <a
            href="/login"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-all"
          >
            <ExternalLink size={18} />
            Login Kasir
          </a>
        </nav>

        {/* User & Logout */}
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
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-danger hover:bg-danger/5 transition-all"
            >
              <LogOut size={18} />
              Keluar
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
