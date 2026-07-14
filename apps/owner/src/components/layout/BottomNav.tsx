"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  MoreHorizontal,
  ExternalLink,
  BarChart3,
  ClipboardList,
  Layers,
  DollarSign,
  Percent,
} from "lucide-react";
import MoreMenuSheet from "./MoreMenuSheet";

const primaryItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Pesanan", icon: ClipboardList },
  { href: "/outlets", label: "Outlet", icon: Building2 },
  { href: "/employees", label: "Karyawan", icon: Users },
];

const overflowMenuItems = [
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/pricing-tiers", label: "Pricing Tiers", icon: Layers },
  { href: "/taxes", label: "Tax", icon: DollarSign },
  { href: "/discounts", label: "Diskon", icon: Percent },
  { href: "/settings", label: "Pengaturan", icon: Settings },
  {
    href: process.env.NEXT_PUBLIC_POS_URL || "http://localhost:3001",
    label: "Login Kasir",
    icon: ExternalLink,
    external: true,
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-neutral-200/60 flex items-stretch z-50 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
        aria-label="Navigasi utama"
      >
        {primaryItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 min-h-[56px] gap-0.5 transition-colors active:scale-95 ${
                active ? "text-forest" : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/4 right-1/4 h-[3px] bg-forest rounded-full" />
              )}
              <Icon size={22} />
              <span className="text-[10px] font-medium leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          onClick={() => setShowMore(true)}
          className={`relative flex flex-col items-center justify-center flex-1 min-h-[56px] gap-0.5 transition-colors active:scale-95 text-neutral-400 hover:text-neutral-600`}
        >
          <span className="absolute top-0 left-1/4 right-1/4 h-[3px] bg-transparent rounded-full" />
          <MoreHorizontal size={22} />
          <span className="text-[10px] font-medium leading-none">Lainnya</span>
        </button>
      </nav>

      <MoreMenuSheet
        isOpen={showMore}
        onClose={() => setShowMore(false)}
        overflowItems={overflowMenuItems}
      />
    </>
  );
}
