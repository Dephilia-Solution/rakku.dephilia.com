"use client";

import { useCartStore, useCartTotals } from "@/lib/store/cartStore";
import { formatCurrency } from "@/lib/dummy-data";
import { ShoppingBag, ArrowRight } from "lucide-react";

interface MobileCartBarProps {
  onViewCart: () => void;
  onCheckout: () => void;
}

export default function MobileCartBar({ onViewCart, onCheckout }: MobileCartBarProps) {
  const items = useCartStore((s) => s.items);
  const itemCount = useCartTotals().itemCount;
  const { total } = useCartTotals();

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-[56px] left-0 right-0 z-[55] lg:hidden safe-bottom">
      <div className="mx-3 mb-2 bg-white rounded-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border border-neutral-200/60 flex items-center gap-3 px-4 py-3 active:scale-[0.99] transition-transform duration-150">
        <button
          onClick={onViewCart}
          className="flex-1 flex items-center gap-3 min-w-0"
        >
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-forest/10 flex items-center justify-center">
              <ShoppingBag size={18} className="text-forest" />
            </div>
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-[9px] font-bold text-white flex items-center justify-center">
              {itemCount > 9 ? "9+" : itemCount}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-neutral-400 font-medium leading-tight">
              {itemCount} item{itemCount > 1 ? "" : ""}
            </p>
            <p className="font-mono font-bold text-neutral-900 text-sm leading-tight">
              {formatCurrency(total)}
            </p>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-medium">
            Detail
            <ArrowRight size={14} />
          </div>
        </button>
        <div className="w-px h-8 bg-neutral-200 flex-shrink-0" />
        <button
          onClick={onCheckout}
          className="flex-shrink-0 bg-forest text-white rounded-xl px-5 py-2.5 font-semibold text-sm active:scale-95 transition-transform duration-150"
        >
          Bayar
        </button>
      </div>
    </div>
  );
}
