import type { DemoViewData } from "@rakku/demo/runtime";

export function productData(view: DemoViewData, productId: string) {
  const product = view.products.find(row => row.id === productId);
  if (!product) return null;
  const recipes = product.recipe.map(line => {
    const ingredient = view.ingredients.find(row => row.id === line.ingredient_id);
    if (!ingredient) throw new Error("Bahan resep tidak tersedia dalam sandbox.");
    return { id: line.id, ingredient_id: ingredient.id, ingredient_name: ingredient.name, ingredient_unit: ingredient.unit, quantity_used: line.quantity_used };
  });
  return { product, recipes, modifiers: view.modifiers.filter(row => row.product_id === product.id) };
}
