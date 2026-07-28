import { notFound } from "next/navigation";
import {
  getAllProducts,
  getCategories,
  getAllPricingTiers,
  getAllModifiers,
  getProductTierPrices,
} from "@/lib/supabase/queries.server";
import ProductForm from "@/components/products/ProductForm";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;

  const [products, categories, pricingTiers, allModifiers, allTierPrices] =
    await Promise.all([
      getAllProducts(),
      getCategories(),
      getAllPricingTiers(),
      getAllModifiers(),
      getProductTierPrices(),
    ]);

  const product = products.find((p) => p.id === id);
  if (!product) notFound();

  const initialTierPrices: Record<string, number> = {};
  for (const tp of allTierPrices) {
    if (tp.product_id === id) {
      initialTierPrices[tp.tier_id] = tp.price;
    }
  }

  const modifiers = allModifiers.filter((m) => m.product_id === id);

  return (
    <ProductForm
      mode="edit"
      productId={id}
      initialProduct={{
        name: product.name,
        category_id: product.category_id,
        description: product.description,
        is_active: product.is_active,
        image_url: product.image_url,
      }}
      categories={categories}
      pricingTiers={pricingTiers}
      initialTierPrices={initialTierPrices}
      initialModifiers={modifiers}
    />
  );
}
