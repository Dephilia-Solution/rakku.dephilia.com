"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useDraftCount } from "@/hooks/useDraftCount";
import { useLowStockCount } from "@/hooks/useLowStockCount";
import type { Menu } from "@rakku/shared-types";

interface MobileBottomNavProps {
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

export default function MobileBottomNav({ menus }: MobileBottomNavProps) {
  const pathname = usePathname();
  const draftCount = useDraftCount();
  const lowStockCount = useLowStockCount();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-neutral-200/60 flex items-stretch z-50 safe-bottom lg:hidden">
      {menus.map((item) => {
        const active =
          pathname === item.path || pathname.startsWith(item.path + "/");

        const Icon = getIcon(item.icon);

        return (
          <Link
            key={item.id}
            href={item.path}
            className={`relative flex flex-col items-center justify-center flex-1 min-h-[56px] gap-0.5 active:scale-95 transition-all duration-150 ${
              active ? "text-forest" : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            {active && (
              <span className="absolute top-0 left-1/4 right-1/4 h-[3px] bg-forest rounded-full" />
            )}
            <div className="relative">
              {Icon ? <Icon size={22} /> : <span className="text-xs font-bold">{item.name.charAt(0)}</span>}
              {item.path === "/register" && draftCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-forest text-[9px] font-bold text-white flex items-center justify-center">
                  {draftCount > 9 ? "9+" : draftCount}
                </span>
              )}
              {item.path === "/ingredients" && lowStockCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-warning text-[9px] font-bold text-white flex items-center justify-center">
                  {lowStockCount > 9 ? "9+" : lowStockCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-none">{item.name}</span>
          </Link>
        );
      })}
      <form action="/api/auth/tenant/logout" method="post" className="flex flex-col items-center justify-center flex-1 min-h-[56px] gap-0.5">
        <button type="submit" className="text-neutral-400 hover:text-danger active:scale-95 transition-all duration-150">
          <LogOut size={22} />
        </button>
        <span className="text-[10px] font-medium text-neutral-400 leading-none">Keluar</span>
      </form>
    </nav>
  );
}
