"use client";

import { useCallback, useEffect, useRef } from "react";
import { fieldInputClass, fieldSelectClass } from "@rakku/ui";
import { useMerchantRequest, useMerchantRuntime, useMerchantToast } from "@/lib/merchant-runtime";

export const inventoryInputClass = `${fieldInputClass} !text-base min-h-11 disabled:opacity-60`;
export const inventorySelectClass = `${fieldSelectClass} !text-base min-h-11 disabled:opacity-60`;
export const inventoryButtonClass = "min-h-11 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
export const inventoryPrimaryClass = `${inventoryButtonClass} bg-primary text-on-primary hover:bg-primary/90`;
export const inventorySecondaryClass = `${inventoryButtonClass} bg-surface-container text-on-surface-variant hover:bg-surface-container-high`;

/** Decimal inputs stay as strings until submission so empty/partial input is not silently saved as zero. */
export function parseInventoryDecimal(value: string): number | null {
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && Number.isSafeInteger(Math.round(number * 100)) ? number : null;
}

export function inventoryNumber(value: number) {
  return Number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export function inventoryRupiah(value: number) {
  return `Rp ${inventoryNumber(value)}`;
}

/** All in-flight requests are invalidated on unmount, outlet change, or runtime replacement. */
export function useInventorySession(outletId: string) {
  const request = useMerchantRequest();
  const showToast = useMerchantToast();
  const isActive = useMerchantRuntime()?.active;
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const next = new AbortController();
    controller.current = next;
    return () => next.abort();
  }, [outletId, request, isActive]);

  const begin = useCallback(() => {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted || isActive?.() === false) return null;
    return { signal, active: () => !signal.aborted && isActive?.() !== false };
  }, [isActive]);

  return { request, showToast, begin };
}

export function InventoryError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-xl border border-error/20 bg-error/5 p-3 text-sm text-error break-words">{message}</p> : null;
}

export function InventoryFormFooter({ formId, saving, onClose, label = "Simpan" }: {
  formId: string;
  saving: boolean;
  onClose: () => void;
  label?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 pb-[env(safe-area-inset-bottom)]">
      <button type="button" disabled={saving} onClick={onClose} className={inventorySecondaryClass}>Batal</button>
      <button type="submit" form={formId} disabled={saving} className={inventoryPrimaryClass}>{saving ? "Menyimpan..." : label}</button>
    </div>
  );
}

// The shared SlideOver close button is 40px; enlarge it locally for this workspace.
export const inventoryPanelClass = "[&_[aria-label='Tutup']]:min-h-11 [&_[aria-label='Tutup']]:min-w-11";
