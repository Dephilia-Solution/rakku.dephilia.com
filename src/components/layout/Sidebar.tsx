"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  ClipboardList,
  BarChart3,
  Package,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/register", icon: ShoppingCart, label: "Register" },
  { href: "/orders", icon: ClipboardList, label: "Orders" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
  { href: "/admin/products", icon: Package, label: "Menu" },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/register") return pathname === "/register";
  if (href === "/admin/products")
    return pathname.startsWith("/admin");
  return pathname.startsWith(href);
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-16 h-screen fixed left-0 top-0 bg-white border-r border-neutral-200 flex-col items-center py-4 gap-1 z-40 hidden lg:flex">
      <Link
        href="/register"
        className="w-10 h-10 rounded-xl bg-forest text-white flex items-center justify-center font-display font-bold text-lg mb-3"
      >
        St
      </Link>

      <div className="w-8 h-px bg-neutral-200 mb-2" />

      <nav className="flex flex-col gap-1 items-center flex-1">
        {navItems.map((item) => {
          const active = isActive(item.href, pathname);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                active
                  ? "bg-forest text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              }`}
              title={item.label}
            >
              <item.icon size={20} />
            </Link>
          );
        })}
      </nav>

      <div className="w-8 h-px bg-neutral-200 mb-2" />

      <form action="/api/auth/logout" method="post">
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
