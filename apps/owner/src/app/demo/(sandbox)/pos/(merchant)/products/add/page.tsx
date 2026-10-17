"use client";
import ProductForm from "@pos/components/products/ProductForm";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() {
  const view = useDemoView();
  return <ProductForm mode="add" categories={view.categories} pricingTiers={view.tiers} />;
}
