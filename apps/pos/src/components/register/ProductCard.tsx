"use client";

import Image from "next/image";
import type { ProductWithCategory } from "@rakku/shared-types";
import { RegisterProductCard } from "@rakku/ui";
import { formatCurrency } from "@pos/lib/format";
import { useCartStore, getTierPrice } from "@pos/lib/store/cartStore";

interface ProductCardProps {
  product: ProductWithCategory;
  onClick: () => void;
}

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
    <RegisterProductCard
      product={product}
      onClick={onClick}
      displayPrice={formatCurrency(displayPrice)}
      discountedPrice={discountedPrice !== null ? formatCurrency(discountedPrice) : null}
      discountLabel={discount ? (discount.type === "percentage" ? `${discount.value}%` : "%") : null}
      renderImage={product.image_url ? (
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform group-hover:scale-105"
        />
      ) : undefined}
    />
  );
}
