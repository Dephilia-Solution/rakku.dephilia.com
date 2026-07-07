"use client";

import { PricingOption } from "@rakku/shared-types";
import { formatCurrency } from "@/lib/dummy-data";
import { Check } from "lucide-react";

interface Props {
  options: PricingOption[];
  selectedId?: string;
  basePrice: number;
  onSelect: (option: PricingOption | null) => void;
}

export default function PricingOptionSelector({ options, selectedId, basePrice, onSelect }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
        Pilih Opsi Harga
      </p>
      <button
        onClick={() => onSelect(null)}
        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex justify-between items-center ${
          !selectedId
            ? "border-forest bg-primary-50"
            : "border-neutral-200 hover:border-neutral-300"
        }`}
      >
        <div>
          <span className="text-sm font-medium text-neutral-900">Harga Standar</span>
          <p className="text-xs text-neutral-400">Harga dasar produk</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-semibold text-neutral-900">
            {formatCurrency(basePrice)}
          </span>
          {!selectedId && <Check size={16} className="text-forest" />}
        </div>
      </button>
      {options
        .filter((o) => o.is_active)
        .map((option) => (
          <button
            key={option.id}
            onClick={() => onSelect(option)}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex justify-between items-center ${
              selectedId === option.id
                ? "border-forest bg-primary-50"
                : "border-neutral-200 hover:border-neutral-300"
            }`}
          >
            <div>
              <span className="text-sm font-medium text-neutral-900">{option.name}</span>
              <p className="text-xs text-neutral-400">Opsi harga khusus</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-semibold text-forest">
                {formatCurrency(option.price)}
              </span>
              {selectedId === option.id && <Check size={16} className="text-forest" />}
            </div>
          </button>
        ))}
    </div>
  );
}
