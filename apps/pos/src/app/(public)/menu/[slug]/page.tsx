import { notFound } from "next/navigation";
import { getPublicMenuBySlug } from "@/lib/supabase/queries.server";
import PublicMenuView from "@pos/components/menu/PublicMenuView";

export const metadata = { title: "Menu", description: "Menu digital Rakku" };
export default async function PublicMenuPage({ params }: { params: { slug: string } }) {
  const menu = await getPublicMenuBySlug(params.slug);
  if (!menu) notFound();
  return <PublicMenuView menu={menu} />;
}
