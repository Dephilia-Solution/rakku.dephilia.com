import { getActiveProducts, getCategories, getAllModifiers } from "@/lib/supabase/queries.server";
import RegisterView from "@/components/register/RegisterView";

export default async function RegisterPage() {
  const [products, categories, modifiers] = await Promise.all([
    getActiveProducts(),
    getCategories(),
    getAllModifiers(),
  ]);

  return (
    <RegisterView
      products={products}
      categories={categories}
      modifiers={modifiers}
    />
  );
}
