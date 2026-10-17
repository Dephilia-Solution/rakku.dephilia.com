"use client";

import type { ReactNode } from "react";
import type { ProductWithCategory } from "@rakku/shared-types";
import { ImageIcon } from "lucide-react";

export interface RegisterProductCardProps {
  product: ProductWithCategory;
  onClick: () => void;
  displayPrice: string;
  discountedPrice: string | null;
  discountLabel: string | null;
  renderImage?: ReactNode;
  nameClassName?: string;
}

const categoryColors: Record<string, string> = {
  Coffee: "bg-amber-100 text-amber-800",
  Pastry: "bg-orange-100 text-orange-800",
  "Non-Coffee": "bg-green-100 text-green-800",
  "Add-ons": "bg-purple-100 text-purple-800",
};

export default function RegisterProductCard({
  product,
  onClick,
  displayPrice,
  discountedPrice,
  discountLabel,
  renderImage,
  nameClassName = "truncate",
}: RegisterProductCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!product.is_active}
      className={`group relative w-full bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-left overflow-hidden ${
        product.is_active
          ? "hover:ring-2 hover:ring-primary-500 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          : "opacity-40 grayscale cursor-not-allowed"
      }`}
    >
      <div className="aspect-[4/3] bg-neutral-100 relative overflow-hidden">
        {product.image_url ? (
          renderImage ?? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={32} className="text-neutral-300" />
          </div>
        )}
        <span
          className={`absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${
            categoryColors[product.category_name] ?? "bg-neutral-100 text-neutral-600"
          }`}
        >
          {product.category_name}
        </span>
        {discountLabel !== null && (
          <span className="absolute top-2 right-2 bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            {discountLabel}
          </span>
        )}
      </div>
      <div className="p-2 sm:p-3">
        <p className={`font-display font-semibold text-xs sm:text-sm text-neutral-900 ${nameClassName} leading-tight`}>
          {product.name}
        </p>
        {discountedPrice !== null ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="font-mono text-xs sm:text-sm text-forest font-semibold">
              {discountedPrice}
            </p>
            <p className="font-mono text-[10px] sm:text-xs text-neutral-400 line-through">
              {displayPrice}
            </p>
          </div>
        ) : (
          <p className="font-mono text-xs sm:text-sm text-forest font-semibold mt-0.5">
            {displayPrice}
          </p>
        )}
      </div>
    </button>
  );
}
