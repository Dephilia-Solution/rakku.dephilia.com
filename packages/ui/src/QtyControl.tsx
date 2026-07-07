"use client";

import { Minus, Plus } from "lucide-react";

interface QtyControlProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
}

export default function QtyControl({
  quantity,
  onIncrement,
  onDecrement,
  min = 0,
}: QtyControlProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onDecrement}
        disabled={quantity <= min}
        className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
      >
        <Minus size={14} />
      </button>
      <span className="font-semibold min-w-[2rem] text-center text-sm text-neutral-900">
        {quantity}
      </span>
      <button
        onClick={onIncrement}
        className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors active:scale-90"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
