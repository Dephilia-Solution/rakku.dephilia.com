"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, LogOut, Users, X } from "lucide-react";
import { usePlan } from "@/components/billing/PlanProvider";
import type { Menu } from "@rakku/shared-types";

interface MoreMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  overflowItems: Menu[];
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

export default function MoreMenuSheet({
  isOpen,
  onClose,
  overflowItems,
  lockedPaths = [],
}: MoreMenuSheetProps) {
  const pathname = usePathname();
  const { openUpgrade } = usePlan();

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] animate-fade-in lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[71] animate-slide-up rounded-t-2xl bg-white shadow-[0_-4px_30px_rgba(0,0,0,0.15)] lg:hidden"
        
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-neutral-300" />
        </div>

        <div className="flex items-center justify-between px-5 py-2">
          <h2 className="font-display font-semibold text-base text-neutral-900">
            Menu Lainnya
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-neutral-700 active:scale-95 transition-all"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pb-2 space-y-1">
          {overflowItems.map((item) => {
            const active = pathname === item.path || pathname.startsWith(item.path + "/");
            const Icon = getIcon(item.icon);
            const locked = lockedPaths.includes(item.path);

            if (locked) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    openUpgrade(
                      `Menu ${item.name} tersedia di paket Pro. Upgrade untuk membuka pembelian, opname, dan alert stok.`
                    );
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left transition-colors active:scale-[0.98] text-neutral-500 hover:bg-neutral-100"
                >
                  {Icon && <Icon size={20} className="text-neutral-400" />}
                  <span className="font-medium text-sm">{item.name}</span>
                  <Lock size={14} className="ml-auto text-amber-500" />
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left transition-colors active:scale-[0.98] ${
                  active
                    ? "bg-forest/10 text-forest"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {Icon && <Icon size={20} className={active ? "text-forest" : "text-neutral-400"} />}
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            );
          })}

          <div className="h-px bg-neutral-200 my-3" />

          <form action="/api/auth/tenant/switch-user" method="post">
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-forest hover:bg-forest/5 transition-colors active:scale-[0.98]"
            >
              <Users size={20} />
              <span className="font-medium text-sm">Ganti User</span>
            </button>
          </form>

          <form action="/api/auth/tenant/logout" method="post">
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-danger hover:bg-red-50 transition-colors active:scale-[0.98]"
            >
              <LogOut size={20} />
              <span className="font-medium text-sm">Keluar</span>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
