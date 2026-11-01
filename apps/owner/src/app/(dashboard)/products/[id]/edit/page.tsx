import { notFound, redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets } from "@/lib/supabase/queries.owner";
import {
  getCompanyCategories,
  getCompanyPricingTiersSimple,
  getCompanyProductById,
  getProductModifiers,
  getProductTierPricesByProduct,
  getProductRecipes,
} from "@/lib/supabase/queries.data";
import OwnerProductForm from "@/components/products/ProductForm";
import type { PricingTier } from "@rakku/shared-types";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ outlet?: string }>;
}

export default async function OwnerEditProductPage({
  params,
}: EditProductPageProps) {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    redirect("/login");
  }

  const { id } = await params;
  const [outlets, product] = await Promise.all([getOwnerOutlets(session.company_id), getCompanyProductById(session.company_id, id)]);
  if (!product) notFound();
  const selected = outlets.find((o) => o.id === product.outlet_id);

  if (!selected) {
    redirect("/outlets");
  }

  const [categories, pricingTiers, modifiers, productTierPrices, recipes] =
    await Promise.all([
      getCompanyCategories(session.company_id, selected.id),
      getCompanyPricingTiersSimple(session.company_id, selected.id),
      getProductModifiers(session.company_id, id),
      getProductTierPricesByProduct(id),
      getProductRecipes(session.company_id, id),
    ]);

  if (!product) notFound();

  const initialTierPrices: Record<string, number> = {};
  for (const tp of productTierPrices) {
    initialTierPrices[tp.tier_id] = tp.price;
  }

  return (
    <OwnerProductForm
      mode="edit"
      productId={id}
      outletId={selected.id}
      outletName={selected.name}
      categories={categories}
      pricingTiers={pricingTiers as PricingTier[]}
      initialProduct={{
        code: product.code,
        name: product.name,
        price: product.price,
        category_id: product.category_id,
        description: product.description,
        is_active: product.is_active,
        image_url: product.image_url,
      }}
      initialTierPrices={initialTierPrices}
      initialModifiers={modifiers}
      initialRecipes={recipes.map((r) => ({
        id: r.id,
        ingredient_id: r.ingredient_id,
        ingredient_name: r.ingredient_name,
        ingredient_unit: r.ingredient_unit,
        quantity_used: r.quantity_used,
        cost_per_unit: r.ingredient_cost_per_unit,
      }))}
    />
  );
}
