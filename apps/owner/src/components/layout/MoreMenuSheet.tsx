"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";

interface MenuItem {
  href: string;
  label: string;
  icon: React.ElementType;
  external?: boolean;
}

interface MoreMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  overflowItems: MenuItem[];
}

export default function MoreMenuSheet({
  isOpen,
  onClose,
  overflowItems,
}: MoreMenuSheetProps) {
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
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] animate-fade-in md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[71] animate-slide-up rounded-t-2xl bg-surface-container-lowest shadow-[0_-4px_30px_rgba(0,0,0,0.15)] md:hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-surface-container-high" />
        </div>

        <div className="flex items-center justify-between px-5 py-2">
          <h2 className="font-display font-semibold text-base text-on-surface">
            Menu Lainnya
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface active:scale-95 transition-all"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pb-6 space-y-1">
          {overflowItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left transition-colors active:scale-[0.98] text-neutral-700 hover:bg-surface-container"
                >
                  <Icon
                    size={20}
                    className={active ? "text-primary" : "text-on-surface-variant"}
                  />
                  <span className="font-medium text-sm">{item.label}</span>
                </a>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left transition-colors active:scale-[0.98] ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-neutral-700 hover:bg-surface-container"
                }`}
              >
                <Icon
                  size={20}
                  className={active ? "text-primary" : "text-on-surface-variant"}
                />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}

          <div className="h-px bg-surface-container my-3" />

          <form action="/api/auth/owner/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-error hover:bg-error-container/20 transition-colors active:scale-[0.98]"
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
