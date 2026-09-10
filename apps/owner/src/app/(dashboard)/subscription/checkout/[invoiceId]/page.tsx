import { notFound, redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import CheckoutClient from "@/components/billing/CheckoutClient";
import type { SubscriptionInvoice } from "@rakku/shared-types";

type InvoiceWithPlan = SubscriptionInvoice & {
  plans?: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

function resolvePlanName(plans: InvoiceWithPlan["plans"]): string {
  if (!plans) return "Paket";
  const plan = Array.isArray(plans) ? plans[0] : plans;
  return plan?.name ?? "Paket";
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) redirect("/login");

  const { invoiceId } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("subscription_invoices")
    .select("*, plans(name, slug)")
    .eq("id", invoiceId)
    .eq("company_id", session.company_id)
    .maybeSingle();

  if (!data) notFound();

  const invoice = data as InvoiceWithPlan;

  return (
    <CheckoutClient
      invoice={{
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        billing_cycle: invoice.billing_cycle,
        status: invoice.status,
        qr_string: invoice.qr_string,
        expired_at: invoice.expired_at,
      }}
      planName={resolvePlanName(invoice.plans)}
    />
  );
}
