"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, LogOut } from "lucide-react";
import { ownerMenuItems, loginKasirItem } from "@/components/layout/nav-config";

interface OwnerSidebarProps {
  owner: {
    name: string;
    email: string;
    companyName: string;
    companyCode: string;
  };
}

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function OwnerSidebar({ owner }: OwnerSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 bottom-0 w-64 bg-surface-container-lowest border-r border-surface-container z-40 flex-col hidden md:flex"
      aria-label="Navigasi utama"
    >
      <div className="h-16 flex items-center gap-3 px-6 border-b border-surface-container">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-on-primary">
          <Store size={18} />
        </div>
        <span className="font-display font-bold text-primary text-lg tracking-tight">
          Rakku
        </span>
      </div>

      <div className="px-4 py-4 border-b border-surface-container">
        <div className="bg-surface-container-low rounded-xl p-3">
          <p className="text-label-caps uppercase text-on-surface-variant mb-1">
            Perusahaan
          </p>
          <p className="text-sm font-bold text-on-surface truncate">
            {owner.companyName}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            Kode: <span className="font-mono">{owner.companyCode}</span>
          </p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto scrollbar-none">
        {ownerMenuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}

        <div className="my-4 border-t border-surface-container" />

        <a
          href={loginKasirItem.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-all"
        >
          <loginKasirItem.icon size={18} />
          {loginKasirItem.label}
        </a>
      </nav>

      <div className="px-4 py-4 border-t border-surface-container">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
            {owner.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-on-surface truncate">
              {owner.name}
            </p>
            <p className="text-xs text-on-surface-variant truncate">
              {owner.email}
            </p>
          </div>
        </div>
        <form action="/api/auth/owner/logout" method="POST">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-error hover:bg-error-container/20 transition-all"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </form>
      </div>
    </aside>
  );
}
