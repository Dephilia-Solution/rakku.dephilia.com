"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Lebar maksimum panel (default max-w-md) */
  widthClassName?: string;
}

export default function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClassName = "max-w-md",
}: SlideOverProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`absolute right-0 top-0 h-full w-full ${widthClassName} bg-surface-container-lowest shadow-2xl animate-slide-in-right flex flex-col`}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-surface-container">
          <div className="min-w-0">
            <h2 className="font-display text-headline-sm text-on-surface truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-on-surface-variant mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-surface-container bg-surface-container-low/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
