"use client";
import { notFound } from "next/navigation";
import ProductForm from "@/components/products/ProductForm";
import { useDemoView } from "@/components/demo/DemoProvider";
import { productData } from "@/components/demo/product-data";
export default function Page({ params }: { params: { id: string } }) {
  const view = useDemoView(), data = productData(view, params.id);
  if (!data) notFound();
  const outlet = view.outlets.find(row => row.id === data.product.outlet_id);
  if (!outlet) notFound();
  return <ProductForm mode="edit" productId={data.product.id} outletId={outlet.id} outletName={outlet.name}
    initialProduct={data.product} initialTierPrices={data.product.prices} initialModifiers={data.modifiers} initialRecipes={data.recipes}
    categories={view.categories.filter(row => row.outlet_id === outlet.id)} pricingTiers={view.tiers.filter(row => row.outlet_id === outlet.id)} />;
}
