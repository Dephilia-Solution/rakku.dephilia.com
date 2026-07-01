import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import InvoicePageClient from "./InvoicePageClient";

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const session = await getTenantSessionFromCookies();
  if (!session) return notFound();

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", params.id)
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .single();

  if (!order) return notFound();

  return <InvoicePageClient order={order} />;
}
