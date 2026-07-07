"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import type { Menu } from "@rakku/shared-types";

interface SidebarProps {
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

export default function Sidebar({ menus }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-16 h-screen fixed left-0 top-0 bg-white border-r border-neutral-200 flex-col items-center py-4 gap-1 z-40 hidden lg:flex">
      <Link
        href="#"
        className="w-10 h-10 rounded-xl bg-forest overflow-hidden mb-3"
      >
        <Image src="/images/rakku_logo.png" alt="Rakku" width={40} height={40} className="w-full h-full object-cover" />
      </Link>

      <div className="w-8 h-px bg-neutral-200 mb-2" />

      <nav className="flex flex-col gap-1 items-center flex-1">
        {menus.map((item) => {
          const active = isActive(item.path, pathname);
          const Icon = getIcon(item.icon);

          return (
            <Link
              key={item.id}
              href={item.path}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                active
                  ? "bg-forest text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              }`}
              title={item.name}
            >
              {Icon ? <Icon size={20} /> : <span className="text-xs font-bold">{item.name.charAt(0)}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="w-8 h-px bg-neutral-200 mb-2" />

      <form action="/api/auth/tenant/logout" method="post">
        <button
          type="submit"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-400 hover:text-danger hover:bg-red-50 transition-colors"
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </form>
    </aside>
  );
}
