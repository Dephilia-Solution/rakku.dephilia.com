import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_TIERS = [
  { name: "Dine In", slug: "dine-in", sort_order: 1 },
  { name: "Take Away", slug: "take-away", sort_order: 2 },
] as const;

export async function seedDefaultTiers(
  supabase: SupabaseClient,
  companyId: string,
  outletId: string
): Promise<void> {
  const rows = DEFAULT_TIERS.map((t) => ({
    company_id: companyId,
    outlet_id: outletId,
    name: t.name,
    slug: t.slug,
    is_active: true,
    sort_order: t.sort_order,
  }));

  // Idempoten: skip slug yang sudah ada untuk outlet ini
  const { data: existing } = await supabase
    .from("pricing_tiers")
    .select("slug")
    .eq("company_id", companyId)
    .eq("outlet_id", outletId);

  const existingSlugs = new Set((existing ?? []).map((t: { slug: string }) => t.slug));
  const toInsert = rows.filter((r) => !existingSlugs.has(r.slug));

  if (toInsert.length > 0) {
    await supabase.from("pricing_tiers").insert(toInsert);
  }
}

export async function syncProductTierPrices(
  supabase: SupabaseClient,
  productId: string,
  companyId: string,
  outletId: string,
  fallbackPrice: number
): Promise<void> {
  const { data: tiers } = await supabase
    .from("pricing_tiers")
    .select("id")
    .eq("company_id", companyId)
    .eq("outlet_id", outletId)
    .eq("is_active", true);

  if (!tiers || tiers.length === 0) return;

  const { data: existing } = await supabase
    .from("product_tier_prices")
    .select("tier_id")
    .eq("product_id", productId);

  const existingTierIds = new Set((existing ?? []).map((p: { tier_id: string }) => p.tier_id));
  const toInsert = tiers
    .filter((t) => !existingTierIds.has(t.id))
    .map((t) => ({
      product_id: productId,
      tier_id: t.id,
      price: fallbackPrice,
    }));

  if (toInsert.length > 0) {
    await supabase.from("product_tier_prices").insert(toInsert);
  }
}
