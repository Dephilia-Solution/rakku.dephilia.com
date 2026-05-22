"use client";

import { useCartStore, useCartTotals } from "@/lib/store/cartStore";
import { formatCurrency } from "@/lib/dummy-data";
import { ShoppingBag } from "lucide-react";

interface FloatingCartButtonProps {
  onClick: () => void;
}

export default function FloatingCartButton({ onClick }: FloatingCartButtonProps) {
  const itemCount = useCartTotals().itemCount;
  const items = useCartStore((s) => s.items);

  if (items.length === 0) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 lg:hidden bg-forest text-white rounded-2xl shadow-lg flex items-center gap-3 px-5 py-3.5 active:scale-95 transition-transform"
    >
      <div className="relative">
        <ShoppingBag size={20} />
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-danger text-[10px] font-bold text-white flex items-center justify-center">
          {itemCount > 9 ? "9+" : itemCount}
        </span>
      </div>
      <span className="font-mono font-semibold text-sm">
        {formatCurrency(
          items.reduce((sum, i) => sum + i.subtotal, 0)
        )}
      </span>
    </button>
  );
}
