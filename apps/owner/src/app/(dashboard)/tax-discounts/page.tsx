import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets } from "@/lib/supabase/queries.owner";

export const dynamic = "force-dynamic";

export default async function TaxDiscountsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; tab?: string }>;
}) {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    redirect("/login");
  }

  const outlets = await getOwnerOutlets(session.company_id);
  const { outlet, tab } = await searchParams;
  const target =
    outlets.find((o) => o.id === outlet) ?? outlets[0];
  if (!target) redirect("/outlets");
  const charge = tab === "produk" || tab === "order" ? `&charge=${tab}` : "";
  redirect(`/outlets/${target.id}?tab=pajak${charge}`);
}
