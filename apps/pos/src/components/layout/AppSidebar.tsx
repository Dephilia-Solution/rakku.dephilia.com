"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, Users } from "lucide-react";
import { useDraftCount } from "@/hooks/useDraftCount";
import type { Menu } from "@rakku/shared-types";

interface AppSidebarProps {
  menus: Menu[];
}

function getIcon(iconName: string | null) {
  if (!iconName) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const icons = require("lucide-react");
    return icons[iconName] || null;
  } catch {
    return null;
  }
}

function isActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

export default function AppSidebar({ menus }: AppSidebarProps) {
  const pathname = usePathname();
  const draftCount = useDraftCount();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-60 bg-surface-container-lowest z-50 hidden md:flex flex-col border-r border-surface-container"
      aria-label="Navigasi utama"
    >
      <div className="p-6 mb-2 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src="/images/rakku_logo.png"
            alt="Rakku"
            width={32}
            height={32}
            className="w-full h-full object-cover"
          />
        </div>
        <span className="font-display font-bold text-lg text-primary tracking-tight">
          Rakku
        </span>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-none">
        {menus.map((item) => {
          const active = isActive(item.path, pathname);
          const Icon = getIcon(item.icon);

          return (
            <Link
              key={item.id}
              href={item.path}
              aria-current={active ? "page" : undefined}
              className={`flex items-center px-4 py-3 rounded-lg transition-all group ${
                active
                  ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}
            >
              <span className="relative mr-3 flex-shrink-0">
                {Icon ? (
                  <Icon size={22} />
                ) : (
                  <span className="text-sm font-bold">
                    {item.name.charAt(0)}
                  </span>
                )}
                {item.path === "/register" && draftCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-forest text-[9px] font-bold text-white flex items-center justify-center">
                    {draftCount > 9 ? "9+" : draftCount}
                  </span>
                )}
              </span>
              <span className="text-sm font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-surface-container space-y-1">
        <form action="/api/auth/tenant/switch-user" method="post">
          <button
            type="submit"
            className="w-full flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-all"
          >
            <Users size={20} className="mr-3" />
            Ganti User
          </button>
        </form>
        <form action="/api/auth/tenant/logout" method="post">
          <button
            type="submit"
            className="w-full flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-error hover:bg-error-container/20 transition-all"
          >
            <LogOut size={20} className="mr-3" />
            Keluar
          </button>
        </form>
      </div>
    </aside>
  );
}
