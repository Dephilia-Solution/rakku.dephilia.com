"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import type { Menu } from "@rakku/shared-types";

interface MoreMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  overflowItems: Menu[];
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

export default function MoreMenuSheet({ isOpen, onClose, overflowItems }: MoreMenuSheetProps) {
  const pathname = usePathname();

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
        style={{ paddingBottom: "calc(var(--nav-bottom-height, 56px) + env(safe-area-inset-bottom, 0px))" }}
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

        <div className="px-3 pb-6 space-y-1">
          {overflowItems.map((item) => {
            const active = pathname === item.path || pathname.startsWith(item.path + "/");
            const Icon = getIcon(item.icon);

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
