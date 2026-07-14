import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets } from "@/lib/supabase/queries.owner";
import { redirect } from "next/navigation";
import PricingTiersClient from "./PricingTiersClient";

export default async function PricingTiersPage() {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    redirect("/login");
  }

  const outlets = await getOwnerOutlets(session.company_id);

  return <PricingTiersClient outlets={outlets.map((o) => ({ id: o.id, name: o.name }))} />;
}
