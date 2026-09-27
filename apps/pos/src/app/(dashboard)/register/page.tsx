import {
  getActiveProducts,
  getCategories,
  getAllModifiers,
  getPricingTiers,
  getProductTierPrices,
  getActiveTaxes,
  getActiveProductDiscounts,
  getActiveOrderDiscounts,
  getDraftOrderCount,
} from "@/lib/supabase/queries.server";
import RegisterView from "@/components/register/RegisterView";

export default async function RegisterPage() {
  const [
    products,
    categories,
    modifiers,
    pricingTiers,
    productTierPrices,
    activeTaxes,
    activeProductDiscounts,
    activeOrderDiscounts,
    draftCount,
  ] = await Promise.all([
    getActiveProducts(),
    getCategories(),
    getAllModifiers(),
    getPricingTiers(),
    getProductTierPrices(),
    getActiveTaxes(),
    getActiveProductDiscounts(),
    getActiveOrderDiscounts(),
    getDraftOrderCount(),
  ]);

  return (
    <RegisterView
      products={products}
      categories={categories}
      modifiers={modifiers}
      initialPricingTiers={pricingTiers}
      initialProductTierPrices={productTierPrices}
      initialActiveTaxes={activeTaxes}
      initialActiveProductDiscounts={activeProductDiscounts}
      initialActiveOrderDiscounts={activeOrderDiscounts}
      initialDraftCount={draftCount}
    />
  );
}
