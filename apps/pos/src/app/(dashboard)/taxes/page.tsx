import { getAllTaxes } from "@/lib/supabase/queries.server";
import TaxesClient from "./TaxesClient";

export default async function TaxesPage() {
  const taxes = await getAllTaxes();
  return <TaxesClient initialTaxes={taxes} />;
}
