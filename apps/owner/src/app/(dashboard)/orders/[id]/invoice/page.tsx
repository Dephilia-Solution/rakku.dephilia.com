import { notFound, redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getCompanyOrderById } from "@/lib/supabase/queries.data";
import InvoicePageClient from "./InvoicePageClient";

export default async function OwnerInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    redirect("/login");
  }

  const order = await getCompanyOrderById(params.id, session.company_id);
  if (!order) return notFound();

  return <InvoicePageClient order={order} />;
}
