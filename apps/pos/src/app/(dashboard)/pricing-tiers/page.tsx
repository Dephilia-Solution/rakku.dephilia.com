import { getAllPricingTiers } from "@/lib/supabase/queries.server";
import PricingTiersClient from "./PricingTiersClient";

export default async function PricingTiersPage() {
  const tiers = await getAllPricingTiers();
  return <PricingTiersClient initialTiers={tiers} />;
}
