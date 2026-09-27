import { notFound } from "next/navigation";
import { getAllIngredients } from "@/lib/supabase/queries.server";
import IngredientForm from "@/components/inventory/IngredientForm";

interface EditIngredientPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditIngredientPage({ params }: EditIngredientPageProps) {
  const { id } = await params;

  const ingredients = await getAllIngredients();
  const ingredient = ingredients.find((i) => i.id === id);
  if (!ingredient) notFound();

  return (
    <IngredientForm
      mode="edit"
      ingredientId={id}
      initialIngredient={{
        name: ingredient.name,
        unit: ingredient.unit,
        stock_quantity: ingredient.stock_quantity,
        min_stock_alert: ingredient.min_stock_alert,
        cost_per_unit: ingredient.cost_per_unit,
        is_active: ingredient.is_active,
      }}
    />
  );
}
