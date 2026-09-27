import { getCategories, getAllPricingTiers } from "@/lib/supabase/queries.server";
import ProductForm from "@/components/products/ProductForm";

export default async function AddProductPage() {
  const [categories, pricingTiers] = await Promise.all([
    getCategories(),
    getAllPricingTiers(),
  ]);

  return (
    <ProductForm mode="add" categories={categories} pricingTiers={pricingTiers} />
  );
}
