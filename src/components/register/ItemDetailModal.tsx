"use client";

import { CartItem, Product } from "@/types";
import { formatCurrency } from "@/lib/dummy-data";
import { X } from "lucide-react";

interface ItemDetailModalProps {
  product: Product;
  variants: CartItem[];
  onClose: () => void;
}

export default function ItemDetailModal({ product, variants, onClose }: ItemDetailModalProps) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-base text-neutral-900">
              {product.name}
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600"
            >
              <X size={16} />
            </button>
          </div>

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

          <button
            onClick={onClose}
            className="mt-4 w-full text-sm text-neutral-400 hover:text-neutral-600 py-2"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
