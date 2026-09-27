import { getAllProducts, getCategories, getProductTierPrices } from "@/lib/supabase/queries.server";
import AdminProductsClient from "./AdminProductsClient";

export default async function AdminProductsPage() {
  const [products, categories, productTierPrices] = await Promise.all([
    getAllProducts(),
    getCategories(),
    getProductTierPrices(),
  ]);

  return <AdminProductsClient products={products} categories={categories} productTierPrices={productTierPrices} />;
}
