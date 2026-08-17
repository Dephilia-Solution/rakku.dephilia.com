import { getAllPurchases } from "@/lib/supabase/queries.server";
import PurchasesClient from "./PurchasesClient";

export default async function PurchasesPage() {
  const purchases = await getAllPurchases();

  return <PurchasesClient purchases={purchases} />;
}