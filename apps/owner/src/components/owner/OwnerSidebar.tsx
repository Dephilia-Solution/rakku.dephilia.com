"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronLeft, LogOut, PanelLeftOpen } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSidebarStore } from "@/lib/store/sidebarStore";
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
  return pathname === href || pathname.startsWith(href + "/");
}

const EXPANDED_WIDTH = 256;
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

export default function OwnerSidebar({ owner }: OwnerSidebarProps) {
  const pathname = usePathname();
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const [logoHovered, setLogoHovered] = useState(false);

  useEffect(() => {
    if (!isCollapsed) setLogoHovered(false);
  }, [isCollapsed]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed top-0 left-0 bottom-0 bg-surface-container-lowest border-r border-surface-container z-40 hidden md:flex flex-col overflow-hidden"
      aria-label="Navigasi utama"
    >
      {/* Header — logo + Rakku + collapse toggle */}
      <div className="flex items-center gap-3 h-[64px] px-2.5 shrink-0 border-b border-surface-container">
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
          className="font-display font-bold text-primary text-lg tracking-tight whitespace-nowrap"
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

      {/* Company card — hidden when collapsed */}
      <motion.div
        initial={false}
        animate={{ opacity: isCollapsed ? 0 : 1, height: isCollapsed ? 0 : "auto" }}
        transition={labelTransition}
        className={`px-2.5 py-3 border-b border-surface-container overflow-hidden ${isCollapsed ? "pointer-events-none" : ""}`}
      >
        <div className="bg-surface-container-low rounded-xl p-3">
          <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-on-surface-variant mb-1">
            Perusahaan
          </p>
          <p className="text-sm font-bold text-on-surface truncate">{owner.companyName}</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Kode: <span className="font-mono">{owner.companyCode}</span>
          </p>
        </div>
      </motion.div>

      <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto scrollbar-none">
        {ownerMenuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 h-11 rounded-xl overflow-hidden flex-shrink-0 transition-colors ${
                isCollapsed ? "w-11" : "w-full"
              } ${
                active
                  ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}
            >
              <span className="w-11 h-11 flex-shrink-0 flex items-center justify-center">
                <Icon size={20} />
              </span>
              <motion.span
                initial={false}
                animate={{ opacity: isCollapsed ? 0 : 1 }}
                transition={labelTransition}
                className="text-sm font-medium whitespace-nowrap"
              >
                {item.label}
              </motion.span>
            </Link>
          );
        })}

        <div className="my-3 border-t border-surface-container" />

        <a
          href={loginKasirItem.href}
          target="_blank"
          rel="noopener noreferrer"
          title={isCollapsed ? loginKasirItem.label : undefined}
          className={`flex items-center gap-3 h-11 rounded-xl overflow-hidden flex-shrink-0 transition-colors ${
            isCollapsed ? "w-11" : "w-full"
          } text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface`}
        >
          <span className="w-11 h-11 flex-shrink-0 flex items-center justify-center">
            <loginKasirItem.icon size={20} />
          </span>
          <motion.span
            initial={false}
            animate={{ opacity: isCollapsed ? 0 : 1 }}
            transition={labelTransition}
            className="text-sm font-medium whitespace-nowrap"
          >
            {loginKasirItem.label}
          </motion.span>
        </a>
      </nav>

      <div className="px-2.5 py-3 border-t border-surface-container space-y-1">
        <div
          title={isCollapsed ? owner.name : undefined}
          className={`flex items-center gap-3 h-11 rounded-xl overflow-hidden flex-shrink-0 ${
            isCollapsed ? "w-11" : "w-full"
          }`}
        >
          <span className="w-11 h-11 flex-shrink-0 flex items-center justify-center">
            <span className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
              {owner.name.charAt(0).toUpperCase()}
            </span>
          </span>
          <motion.div
            initial={false}
            animate={{ opacity: isCollapsed ? 0 : 1 }}
            transition={labelTransition}
            className="flex-1 min-w-0 whitespace-nowrap overflow-hidden"
          >
            <p className="text-sm font-semibold text-on-surface truncate leading-none">{owner.name}</p>
            <p className="text-xs text-on-surface-variant truncate leading-none mt-0.5">{owner.email}</p>
          </motion.div>
        </div>
        <form action="/api/auth/owner/logout" method="POST">
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
