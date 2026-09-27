"use client";

import { ProductWithCategory } from "@rakku/shared-types";
import ProductCard from "./ProductCard";

interface ProductGridProps {
  products: ProductWithCategory[];
  onSelect: (product: ProductWithCategory) => void;
}

export default function ProductGrid({ products, onSelect }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <p className="text-sm">Tidak ada produk</p>
      </div>
    );
  }

  return (
    <div
      className="grid p-2 gap-1.5 sm:gap-3 overflow-hidden"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={() => onSelect(product)}
        />
      ))}
    </div>
  );
}