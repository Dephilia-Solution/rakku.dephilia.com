"use client";

import { useEffect, useRef } from "react";
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

// Nested editors share one scroll lock; Escape belongs to the topmost panel.
const panels: symbol[] = [];
let originalOverflow = "";

export default function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClassName = "max-w-md",
}: SlideOverProps) {
  const close = useRef(onClose);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const resize = () => {
      panel.current?.style.setProperty("--sheet-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      panel.current?.style.setProperty("--sheet-offset-top", `${viewport?.offsetTop ?? 0}px`);
    };
    resize(); viewport?.addEventListener("resize", resize); viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => { viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize); window.removeEventListener("resize", resize); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const token = Symbol("slide-over");
    if (panels.length === 0) originalOverflow = document.body.style.overflow;
    panels.push(token);
    const previousFocus = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && panels[panels.length - 1] === token) {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab" && panels[panels.length - 1] === token) {
        const elements = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') ?? []).filter(element => element.getClientRects().length);
        const first = elements[0], last = elements.at(-1);
        if (!first) { e.preventDefault(); panel.current?.focus(); }
        else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      const index = panels.indexOf(token);
      if (index >= 0) panels.splice(index, 1);
      if (panels.length === 0) document.body.style.overflow = originalOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-on-surface/40 animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={panel} tabIndex={-1}
        style={{ height: "var(--sheet-viewport-height, 100dvh)", top: "var(--sheet-offset-top, 0px)" }}
        className={`absolute right-0 top-0 h-[100dvh] max-h-full w-full ${widthClassName} bg-surface-container-lowest shadow-xl motion-safe:animate-slide-in-right flex flex-col outline-none`}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 px-4 sm:px-6 py-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-surface-container">
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
             className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
        {footer && (
          <div className="shrink-0 px-4 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-surface-container bg-surface-container-low/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
