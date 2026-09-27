import { getAllIngredients } from "@/lib/supabase/queries.server";
import IngredientsClient from "./IngredientsClient";

export default async function IngredientsPage() {
  const ingredients = await getAllIngredients();

  return <IngredientsClient ingredients={ingredients} />;
}
