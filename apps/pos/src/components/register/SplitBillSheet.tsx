"use client";

import { useEffect } from "react";
import { SplitPayment, CartItem } from "@rakku/shared-types";
import { formatCurrency } from "@/lib/dummy-data";
import { useIsMobile } from "@/hooks/useMediaQuery";
import SplitBillPanel from "@/components/register/SplitBillPanel";
import { X, ChevronLeft } from "lucide-react";

interface SplitBillSheetProps {
  items: CartItem[];
  total: number;
  splitPayments: SplitPayment[];
  onSplitChange: (payments: SplitPayment[]) => void;
  onCancel: () => void;
  onContinue: () => void;
}

export default function SplitBillSheet({
  items,
  total,
  splitPayments,
  onSplitChange,
  onCancel,
  onContinue,
}: SplitBillSheetProps) {
  const isMobile = useIsMobile();
  const splitTotal = splitPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const content = (
    <>
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-200">
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={onCancel}
            aria-label="Batal split bill"
            className="w-11 h-11 -ml-2 sm:-ml-3 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 active:scale-95 transition-all flex-shrink-0"
          >
            <ChevronLeft size={20} />
          </button>
          <h3 className="font-display font-semibold text-base text-neutral-900">
            Split Bill
          </h3>
        </div>
        <button
          onClick={onCancel}
          aria-label="Tutup"
          className="w-11 h-11 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600 active:scale-95 transition-all flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4">
        <SplitBillPanel
          items={items}
          total={total}
          onSplitChange={onSplitChange}
        />
      </div>

      <div className="px-4 sm:px-6 py-4 border-t border-neutral-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-neutral-400">Terbagi</p>
            <p className="font-mono text-sm font-semibold text-neutral-900 truncate">
              {splitPayments.length > 0
                ? `${splitPayments.length} orang · ${formatCurrency(splitTotal)}`
                : "Belum ada item terbagi"}
            </p>
          </div>
          <button
            onClick={onContinue}
            disabled={splitPayments.length === 0}
            className="flex-shrink-0 bg-forest text-white rounded-xl px-6 py-3.5 font-semibold text-sm hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Lanjut
          </button>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onCancel} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Split Bill"
          className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90dvh] animate-slide-up pb-safe"
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-neutral-300" />
          </div>
          <div className="flex flex-col flex-1 min-h-0">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onCancel}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Split Bill"
          className="bg-white rounded-2xl shadow-md w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    </div>
  );
}