"use client";
import Products from "@pos/app/(dashboard)/products/AdminProductsClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { const view = useDemoView(); return <Products products={view.productsWithCategory} categories={view.categories} productTierPrices={view.productTierPrices} />; }
