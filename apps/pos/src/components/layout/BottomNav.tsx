"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, ShoppingCart, ClipboardList, BarChart3, Package } from "lucide-react";
import { useCartStore } from "@/lib/store/cartStore";
import MoreMenuSheet from "./MoreMenuSheet";
import type { Menu } from "@rakku/shared-types";

interface BottomNavProps {
  menus: Menu[];
  primaryCount?: number;
}

const ICON_MAP: Record<string, typeof ShoppingCart> = {
  ShoppingCart: ShoppingCart,
  ClipboardList: ClipboardList,
  BarChart3: BarChart3,
  Package: Package,
};

function getIcon(iconName: string | null) {
  if (!iconName) return null;
  if (ICON_MAP[iconName]) return ICON_MAP[iconName];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const icons = require("lucide-react");
    return icons[iconName] || null;
  } catch {
    return null;
  }
}

export default function BottomNav({ menus, primaryCount = 4 }: BottomNavProps) {
  const pathname = usePathname();
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const [showMore, setShowMore] = useState(false);

  const primaryItems = menus.slice(0, primaryCount);
  const overflowItems = menus.slice(primaryCount);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest/90 backdrop-blur-xl border-t border-surface-container flex items-stretch z-50 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
        aria-label="Navigasi utama"
      >
        {primaryItems.map((item) => {
          const active = pathname === item.path || pathname.startsWith(item.path + "/");
          const Icon = getIcon(item.icon);

          return (
            <Link
              key={item.id}
              href={item.path}
              className={`relative flex flex-col items-center justify-center flex-1 min-h-[56px] gap-0.5 transition-colors active:scale-95 ${
                active ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/4 right-1/4 h-[3px] bg-primary rounded-full" />
              )}
              <div className="relative">
                {Icon ? <Icon size={22} /> : <span className="text-xs font-bold">{item.name.charAt(0)}</span>}
                {item.path === "/register" && itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-danger text-[9px] font-bold text-white flex items-center justify-center">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{item.name}</span>
            </Link>
          );
        })}

        {overflowItems.length > 0 && (
          <button
            onClick={() => setShowMore(true)}
            className={`relative flex flex-col items-center justify-center flex-1 min-h-[56px] gap-0.5 transition-colors active:scale-95 text-on-surface-variant hover:text-on-surface`}
          >
            <span className="absolute top-0 left-1/4 right-1/4 h-[3px] bg-transparent rounded-full" />
            <MoreHorizontal size={22} />
            <span className="text-[10px] font-medium leading-none">Lainnya</span>
          </button>
        )}
      </nav>

      <MoreMenuSheet
        isOpen={showMore}
        onClose={() => setShowMore(false)}
        overflowItems={overflowItems}
      />
    </>
  );
}
