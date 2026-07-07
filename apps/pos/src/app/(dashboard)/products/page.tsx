import { getAllProducts, getCategories, getAllModifiers, getPricingTiers, getProductTierPrices } from "@/lib/supabase/queries.server";
import AdminProductsClient from "./AdminProductsClient";

export default async function AdminProductsPage() {
  const [products, categories, modifiers, pricingTiers, productTierPrices] = await Promise.all([
    getAllProducts(),
    getCategories(),
    getAllModifiers(),
    getPricingTiers(),
    getProductTierPrices(),
  ]);

  return <AdminProductsClient products={products} categories={categories} modifiers={modifiers} pricingTiers={pricingTiers} productTierPrices={productTierPrices} />;
}
