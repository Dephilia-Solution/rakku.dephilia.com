"use client";

import { CartItem, Product } from "@rakku/shared-types";
import { formatCurrency } from "@/lib/format";
import { X } from "lucide-react";

interface ItemDetailModalProps {
  product: Product;
  variants: CartItem[];
  onClose: () => void;
}

export default function ItemDetailModal({ product, variants, onClose }: ItemDetailModalProps) {

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
        <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-md w-full sm:max-w-sm mobile-slide-up pb-safe sm:pb-0 max-h-[90dvh] sm:max-h-none overflow-hidden flex flex-col">
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-neutral-300" />
          </div>

          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-200">
            <h3 className="font-display font-semibold text-base text-neutral-900">
              {product.name}
            </h3>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600 active:scale-95 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-4 sm:px-6 py-4 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4 text-sm text-neutral-500">
              <span>{variants.reduce((s, v) => s + v.quantity, 0)} item</span>
              <span>&middot;</span>
              <span className="font-mono font-semibold text-neutral-900">
                {formatCurrency(variants.reduce((s, v) => s + v.subtotal, 0))}
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {variants.map((variant) => (
                <div
                  key={variant.id}
                  className="bg-neutral-50 rounded-xl px-4 py-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">
                          x{variant.quantity}
                        </span>
                        {variant.modifier_label ? (
                          <span className="text-sm text-neutral-600 truncate">
                            {variant.modifier_label}
                          </span>
                        ) : (
                          <span className="text-sm text-neutral-400">
                            Regular
                          </span>
                        )}
                      </div>
                      {variant.pricing_tier_id && (
                        <p className="text-xs text-neutral-400 mt-0.5">
                          (Tier pricing)
                        </p>
                      )}
                      {variant.note && (
                        <p className="text-xs text-neutral-400 italic mt-0.5">
                          Catatan: {variant.note}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-sm font-semibold text-neutral-900 whitespace-nowrap ml-2">
                      {formatCurrency(variant.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-neutral-200">
              <span className="text-sm font-medium text-neutral-600">Total</span>
              <span className="font-mono font-bold text-neutral-900">
                {formatCurrency(variants.reduce((s, v) => s + v.subtotal, 0))}
              </span>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-neutral-200 bg-white">
            <button
              onClick={onClose}
              className="w-full bg-neutral-100 text-neutral-700 rounded-xl py-3.5 font-semibold text-sm hover:bg-neutral-200 active:scale-[0.98] transition-all"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
