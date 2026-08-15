"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Users } from "lucide-react";
import { useDraftCount } from "@/hooks/useDraftCount";
import type { Menu } from "@rakku/shared-types";

interface SideRailProps {
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

export default function SideRail({ menus }: SideRailProps) {
  const pathname = usePathname();
  const draftCount = useDraftCount();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-16 bg-white/95 backdrop-blur-xl border-r border-neutral-200/60 flex flex-col items-center py-3 gap-1 z-40 hidden md:hidden"
      aria-label="Navigasi"
    >
      <nav className="flex flex-col gap-1 items-center flex-1 overflow-y-auto py-2 scrollbar-none">
        {menus.map((item) => {
          const active = pathname === item.path || pathname.startsWith(item.path + "/");
          const Icon = getIcon(item.icon);

          return (
            <Link
              key={item.id}
              href={item.path}
              title={item.name}
              className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                active
                  ? "bg-forest text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {Icon ? <Icon size={20} /> : <span className="text-xs font-bold">{item.name.charAt(0)}</span>}
              {item.path === "/register" && draftCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-forest text-[8px] font-bold text-white flex items-center justify-center">
                  {draftCount > 9 ? "9+" : draftCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="w-8 h-px bg-neutral-200 my-1" />

      <div className="flex flex-col items-center gap-1">
        <form action="/api/auth/tenant/switch-user" method="post">
          <button
            type="submit"
            title="Ganti User"
            className="w-12 h-12 rounded-xl flex items-center justify-center text-neutral-400 hover:text-forest hover:bg-forest/5 transition-colors active:scale-95"
          >
            <Users size={20} />
          </button>
        </form>
        <form action="/api/auth/tenant/logout" method="post">
          <button
            type="submit"
            title="Keluar"
            className="w-12 h-12 rounded-xl flex items-center justify-center text-neutral-400 hover:text-danger hover:bg-red-50 transition-colors active:scale-95"
          >
            <LogOut size={20} />
          </button>
        </form>
      </div>
    </aside>
  );
}
