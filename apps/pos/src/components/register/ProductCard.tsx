"use client";

import Image from "next/image";
import { ProductWithCategory } from "@rakku/shared-types";
import { formatCurrency } from "@/lib/dummy-data";
import { useCartStore, getTierPrice } from "@/lib/store/cartStore";
import { ImageIcon, Percent } from "lucide-react";

interface ProductCardProps {
  product: ProductWithCategory;
  onClick: () => void;
}

const categoryColors: Record<string, string> = {
  Coffee: "bg-amber-100 text-amber-800",
  Pastry: "bg-orange-100 text-orange-800",
  "Non-Coffee": "bg-green-100 text-green-800",
  "Add-ons": "bg-purple-100 text-purple-800",
};

function useProductDiscount(productId: string) {
  const activeProductDiscounts = useCartStore((s) => s.activeProductDiscounts);
  return activeProductDiscounts.find((d) => d.product_id === productId) ?? null;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  const pricingTierId = useCartStore((s) => s.pricingTierId);
  const productTierPriceMap = useCartStore((s) => s.productTierPriceMap);
  const displayPrice = getTierPrice(product.id, pricingTierId, productTierPriceMap, product.price);

  const discount = useProductDiscount(product.id);
  const discountedPrice = discount
    ? discount.type === "percentage"
      ? displayPrice * (1 - discount.value / 100)
      : Math.max(0, displayPrice - discount.value)
    : null;

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
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
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
        {discount && (
          <span className="absolute top-2 right-2 bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Percent size={8} />
            {discount.type === "percentage" ? `${discount.value}%` : "Diskon"}
          </span>
        )}
      </div>
      <div className="p-2 sm:p-3">
        <p className="font-display font-semibold text-xs sm:text-sm text-neutral-900 truncate leading-tight">
          {product.name}
        </p>
        {discount && discountedPrice !== null ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="font-mono text-xs sm:text-sm text-forest font-semibold">
              {formatCurrency(discountedPrice)}
            </p>
            <p className="font-mono text-[10px] sm:text-xs text-neutral-400 line-through">
              {formatCurrency(displayPrice)}
            </p>
          </div>
        ) : (
          <p className="font-mono text-xs sm:text-sm text-forest font-semibold mt-0.5">
            {formatCurrency(displayPrice)}
          </p>
        )}
      </div>
    </button>
  );
}
