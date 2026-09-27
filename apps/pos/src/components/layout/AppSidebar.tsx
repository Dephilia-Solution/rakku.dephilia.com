"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronLeft, LogOut, Lock, PanelLeftOpen, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useDraftCount } from "@/hooks/useDraftCount";
import { useLowStockCount } from "@/hooks/useLowStockCount";
import { useSidebarStore } from "@/lib/store/sidebarStore";
import { usePlan } from "@/components/billing/PlanProvider";
import type { Menu } from "@rakku/shared-types";

interface AppSidebarProps {
  menus: Menu[];
  lockedPaths?: string[];
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

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

const labelTransition = { duration: 0.2, ease: "easeInOut" } as const;

function LogoSlot({
  isCollapsed,
  logoHovered,
}: {
  isCollapsed: boolean;
  logoHovered: boolean;
}) {
  return (
    <span className="relative block w-11 h-11 rounded-lg bg-primary overflow-hidden">
      <motion.span
        initial={false}
        animate={{ opacity: isCollapsed && logoHovered ? 0 : 1 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <Image
          src="/images/rakku_logo.png"
          alt="Rakku"
          width={44}
          height={44}
          className="w-full h-full object-cover"
        />
      </motion.span>
      <motion.span
        initial={false}
        animate={{ opacity: isCollapsed && logoHovered ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 flex items-center justify-center text-white"
        aria-hidden={!(isCollapsed && logoHovered)}
      >
        <PanelLeftOpen size={22} />
      </motion.span>
    </span>
  );
}

export default function AppSidebar({
  menus,
  lockedPaths = [],
}: AppSidebarProps) {
  const pathname = usePathname();
  const { openUpgrade } = usePlan();
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const draftCount = useDraftCount();
  const lowStockCount = useLowStockCount();
  const [logoHovered, setLogoHovered] = useState(false);

  useEffect(() => {
    if (!isCollapsed) setLogoHovered(false);
  }, [isCollapsed]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-full bg-surface-container-lowest z-50 hidden md:flex flex-col border-r border-surface-container overflow-hidden"
      aria-label="Navigasi utama"
    >
      <div className="flex items-center gap-3 h-[76px] px-2.5 shrink-0">
        <div
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
          className="flex-shrink-0"
        >
          <Link
            href="#"
            aria-label={isCollapsed ? "Perluas sidebar" : "Rakku"}
            onClick={(e) => {
              if (isCollapsed) {
                e.preventDefault();
                setCollapsed(false);
              }
            }}
          >
            <LogoSlot isCollapsed={isCollapsed} logoHovered={logoHovered} />
          </Link>
        </div>

        <motion.span
          initial={false}
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          transition={labelTransition}
          className="font-display font-bold text-lg text-primary tracking-tight whitespace-nowrap"
        >
          Rakku
        </motion.span>

        <motion.button
          type="button"
          onClick={toggleCollapsed}
          initial={false}
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          transition={labelTransition}
          tabIndex={isCollapsed ? -1 : 0}
          aria-label="Ciutkan sidebar"
          className={`ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface flex-shrink-0 transition-colors ${
            isCollapsed ? "pointer-events-none" : ""
          }`}
        >
          <ChevronLeft size={18} />
        </motion.button>
      </div>

      <nav className="flex-1 px-2.5 space-y-1 overflow-y-auto scrollbar-none">
        {menus.map((item) => {
          const active = isActive(item.path, pathname);
          const Icon = getIcon(item.icon);
          const locked = lockedPaths.includes(item.path);

          const className = `flex items-center gap-3 h-11 rounded-xl overflow-hidden flex-shrink-0 transition-colors ${
            isCollapsed ? "w-11" : "w-full"
          } ${
            active
              ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
              : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
          }`;

          const content = (
            <>
              <span className="relative w-11 h-11 flex-shrink-0 flex items-center justify-center">
                {Icon ? (
                  <Icon size={22} />
                ) : (
                  <span className="text-sm font-bold">
                    {item.name.charAt(0)}
                  </span>
                )}
                {item.path === "/register" && draftCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-forest text-[9px] font-bold text-white flex items-center justify-center">
                    {draftCount > 9 ? "9+" : draftCount}
                  </span>
                )}
                {item.path === "/ingredients" &&
                  !locked &&
                  lowStockCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-warning text-[9px] font-bold text-white flex items-center justify-center">
                      {lowStockCount > 9 ? "9+" : lowStockCount}
                    </span>
                  )}
                {locked && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                    <Lock size={9} />
                  </span>
                )}
              </span>
              <motion.span
                initial={false}
                animate={{ opacity: isCollapsed ? 0 : 1 }}
                transition={labelTransition}
                className="text-sm font-medium whitespace-nowrap"
              >
                {item.name}
              </motion.span>
            </>
          );

          if (locked) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  openUpgrade(
                    `Menu ${item.name} tersedia di paket Pro. Upgrade untuk membuka pembelian, opname, dan alert stok.`
                  )
                }
                title={isCollapsed ? item.name : undefined}
                className={className}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.path}
              aria-current={active ? "page" : undefined}
              title={isCollapsed ? item.name : undefined}
              className={className}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      <div className="px-2.5 py-3 border-t border-surface-container space-y-1">
        <form action="/api/auth/tenant/switch-user" method="post">
          <button
            type="submit"
            title={isCollapsed ? "Ganti User" : undefined}
            className={`flex items-center gap-3 h-11 rounded-xl overflow-hidden flex-shrink-0 transition-colors ${
              isCollapsed ? "w-11" : "w-full"
            } text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface`}
          >
            <span className="w-11 h-11 flex-shrink-0 flex items-center justify-center">
              <Users size={20} />
            </span>
            <motion.span
              initial={false}
              animate={{ opacity: isCollapsed ? 0 : 1 }}
              transition={labelTransition}
              className="text-sm font-medium whitespace-nowrap"
            >
              Ganti User
            </motion.span>
          </button>
        </form>
        <form action="/api/auth/tenant/logout" method="post">
          <button
            type="submit"
            title={isCollapsed ? "Keluar" : undefined}
            className={`flex items-center gap-3 h-11 rounded-xl overflow-hidden flex-shrink-0 transition-colors ${
              isCollapsed ? "w-11" : "w-full"
            } text-error hover:bg-error-container/20`}
          >
            <span className="w-11 h-11 flex-shrink-0 flex items-center justify-center">
              <LogOut size={20} />
            </span>
            <motion.span
              initial={false}
              animate={{ opacity: isCollapsed ? 0 : 1 }}
              transition={labelTransition}
              className="text-sm font-medium whitespace-nowrap"
            >
              Keluar
            </motion.span>
          </button>
        </form>
      </div>
    </motion.aside>
  );
}