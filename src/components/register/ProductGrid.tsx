"use client";

import { ProductWithCategory } from "@/types";
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
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
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
