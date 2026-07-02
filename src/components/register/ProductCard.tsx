"use client";

import Image from "next/image";
import { ProductWithCategory } from "@/types";
import { formatCurrency } from "@/lib/dummy-data";
import { useCartStore, getTierPrice } from "@/lib/store/cartStore";
import { ImageIcon } from "lucide-react";

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

export default function ProductCard({ product, onClick }: ProductCardProps) {
  const pricingTierId = useCartStore((s) => s.pricingTierId);
  const productTierPriceMap = useCartStore((s) => s.productTierPriceMap);
  const displayPrice = getTierPrice(product.id, pricingTierId, productTierPriceMap, product.price);

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
      </div>
      <div className="p-2 sm:p-3">
        <p className="font-display font-semibold text-xs sm:text-sm text-neutral-900 truncate leading-tight">
          {product.name}
        </p>
        <p className="font-mono text-xs sm:text-sm text-forest font-semibold mt-0.5">
          {formatCurrency(displayPrice)}
        </p>
      </div>
    </button>
  );
}
