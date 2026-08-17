import { getAllIngredients } from "@/lib/supabase/queries.server";
import AddPurchaseForm from "./AddPurchaseForm";

export default async function AddPurchasePage() {
  const ingredients = await getAllIngredients();

  return <AddPurchaseForm ingredients={ingredients} />;
}