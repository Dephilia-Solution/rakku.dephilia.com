"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useCartStore } from "@/lib/store/cartStore";
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
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));

  return (
    <aside
      className="w-16 h-dvh fixed left-0 top-0 bg-white border-r border-neutral-200 flex flex-col items-center z-40 hidden md:flex"
      aria-label="Navigasi utama"
    >
      <div className="w-10 h-10 rounded-xl bg-forest overflow-hidden flex-shrink-0 mt-3 mb-2">
        <Image
          src="/images/rakku_logo.png"
          alt="Rakku"
          width={40}
          height={40}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="w-8 h-px bg-neutral-100 my-2" />

      <nav className="flex flex-col gap-1 items-center flex-1 overflow-y-auto py-2 scrollbar-none">
        {menus.map((item) => {
          const active = isActive(item.path, pathname);
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
              {Icon ? (
                <Icon size={20} />
              ) : (
                <span className={`text-xs font-bold ${active ? "text-white" : "text-neutral-400"}`}>
                  {item.name.charAt(0)}
                </span>
              )}
              {item.path === "/register" && itemCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-danger text-[8px] font-bold text-white flex items-center justify-center">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="w-8 h-px bg-neutral-200 my-1" />

      <form action="/api/auth/tenant/logout" method="post">
        <button
          type="submit"
          title="Keluar"
          className="w-12 h-12 rounded-xl flex items-center justify-center text-neutral-400 hover:text-danger hover:bg-red-50 transition-colors active:scale-95 mb-3"
        >
          <LogOut size={20} />
        </button>
      </form>
    </aside>
  );
}
