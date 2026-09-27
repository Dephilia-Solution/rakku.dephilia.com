import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets } from "@/lib/supabase/queries.owner";
import TaxDiscountsClient from "./TaxDiscountsClient";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function TaxDiscountsPage({ searchParams }: PageProps) {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    redirect("/login");
  }

  const { tab } = await searchParams;
  const outlets = await getOwnerOutlets(session.company_id);
  const initialTab =
    tab === "produk" || tab === "order" || tab === "pajak" ? tab : "pajak";

  return (
    <TaxDiscountsClient
      outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
      initialTab={initialTab}
    />
  );
}
