import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets } from "@/lib/supabase/queries.owner";
import { redirect } from "next/navigation";
import TaxesClient from "./TaxesClient";

export default async function TaxesPage() {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    redirect("/login");
  }

  const outlets = await getOwnerOutlets(session.company_id);

  return <TaxesClient outlets={outlets.map((o) => ({ id: o.id, name: o.name }))} />;
}
