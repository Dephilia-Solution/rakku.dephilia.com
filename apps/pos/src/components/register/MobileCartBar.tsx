"use client";

import { useNavMode } from "@/hooks/useNavMode";
import { useCartStore, useCartTotals } from "@/lib/store/cartStore";
import { formatCurrency } from "@/lib/dummy-data";
import { ArrowRight, ShoppingBag } from "lucide-react";

interface MobileCartBarProps {
  onViewCart: () => void;
}

export default function MobileCartBar({ onViewCart }: MobileCartBarProps) {
  const mode = useNavMode();
  const items = useCartStore((s) => s.items);
  const itemCount = useCartTotals().itemCount;
  const { total } = useCartTotals();

  if (items.length === 0) return null;
  if (mode === "rail") return null;

  const bottomOffset = mode === "bottom"
    ? "var(--nav-bottom-safe)"
    : "env(safe-area-inset-bottom, 0px)";

  return (
    <div
      // FIX: md:left-16 menggeser bar sejauh lebar AppSidebar rail
      // (w-16 = 64px, muncul mulai breakpoint md juga: "hidden md:flex"),
      // supaya bar gak numpuk di atas rail saat keduanya sama-sama tampil.
      // FIX: lg:hidden (bukan xl:hidden) disamakan dengan breakpoint
      // OrderSidebar desktop ("hidden lg:flex" di OrderSidebar.tsx),
      // supaya bar ini hilang PERSIS saat sidebar cart kanan muncul —
      // sebelumnya ada gap lg–xl di mana keduanya tampil bareng (redundant).
      className="fixed left-0 md:left-16 right-0 z-[55] lg:hidden safe-bottom"
      style={{ bottom: bottomOffset }}
    >
      <div className="mx-3 mb-2">
        <button
          onClick={onViewCart}
          className="flex items-center gap-3 w-full bg-forest rounded-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] px-4 py-3 active:scale-[0.98] transition-transform"
        >
          <div className="relative flex-shrink-0">
            <ShoppingBag size={20} className="text-white" />
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-white text-forest text-[9px] font-bold flex items-center justify-center">
              {itemCount > 9 ? "9+" : itemCount}
            </span>
          </div>
          <span className="text-white text-sm font-medium">{itemCount} item</span>
          <span className="text-white/60 text-sm">•</span>
          <span className="font-mono font-bold text-white text-sm flex-1 text-right">
            {formatCurrency(total)}
          </span>
          <span className="text-white flex items-center gap-2 text-sm font-semibold bg-white/20 rounded-lg px-3 py-1.5">
            Detail
            <ArrowRight size={16} />
          </span>
        </button>
      </div>
    </div>
  );
}