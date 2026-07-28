import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets } from "@/lib/supabase/queries.owner";
import {
  getCompanyCategories,
  getCompanyPricingTiersSimple,
} from "@/lib/supabase/queries.data";
import OwnerProductForm from "@/components/products/ProductForm";

interface AddProductPageProps {
  searchParams: Promise<{ outlet?: string }>;
}

export default async function OwnerAddProductPage({
  searchParams,
}: AddProductPageProps) {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    redirect("/login");
  }

  const { outlet } = await searchParams;
  const outlets = await getOwnerOutlets(session.company_id);
  const selected =
    outlets.find((o) => o.id === outlet) ?? outlets[0];

  if (!selected) {
    redirect("/outlets");
  }

  const [categories, pricingTiers] = await Promise.all([
    getCompanyCategories(session.company_id, selected.id),
    getCompanyPricingTiersSimple(session.company_id, selected.id),
  ]);

  return (
    <OwnerProductForm
      mode="add"
      outletId={selected.id}
      outletName={selected.name}
      categories={categories}
      pricingTiers={pricingTiers}
    />
  );
}
