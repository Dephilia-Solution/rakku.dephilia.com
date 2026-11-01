"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import ProductForm from "@pos/components/products/ProductForm";
import { useDemoView } from "@/components/demo/DemoProvider";
import { productData } from "@/components/demo/product-data";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const routeParams = use(params);
  const view = useDemoView(), data = productData(view, routeParams.id);
  if (!data) notFound();
  return <ProductForm mode="edit" productId={data.product.id} initialProduct={data.product} categories={view.categories}
    pricingTiers={view.tiers} initialTierPrices={data.product.prices} initialModifiers={data.modifiers} initialRecipes={data.recipes} />;
}
