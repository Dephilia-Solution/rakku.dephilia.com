"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import IngredientForm from "@pos/components/inventory/IngredientForm";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const routeParams = use(params);
  const ingredient = useDemoView().ingredients.find(row => row.id === routeParams.id);
  if (!ingredient) notFound();
  return <IngredientForm mode="edit" ingredientId={ingredient.id} initialIngredient={ingredient} />;
}
