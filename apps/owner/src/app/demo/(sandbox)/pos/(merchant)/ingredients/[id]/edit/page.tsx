"use client";
import { notFound } from "next/navigation";
import IngredientForm from "@pos/components/inventory/IngredientForm";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page({ params }: { params: { id: string } }) {
  const ingredient = useDemoView().ingredients.find(row => row.id === params.id);
  if (!ingredient) notFound();
  return <IngredientForm mode="edit" ingredientId={ingredient.id} initialIngredient={ingredient} />;
}
