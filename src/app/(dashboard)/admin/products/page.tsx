import { getAllProducts, getCategories, getAllModifiers } from "@/lib/supabase/queries.server";
import AdminProductsClient from "./AdminProductsClient";

export default async function AdminProductsPage() {
  const [products, categories, modifiers] = await Promise.all([
    getAllProducts(),
    getCategories(),
    getAllModifiers(),
  ]);

  return <AdminProductsClient products={products} categories={categories} modifiers={modifiers} />;
}
