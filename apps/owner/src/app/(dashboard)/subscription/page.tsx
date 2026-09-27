import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { getUsageSummary } from "@rakku/plans";
import SubscriptionClient from "@/components/billing/SubscriptionClient";
import type { Plan, SubscriptionInvoice } from "@rakku/shared-types";

type InvoiceWithPlan = SubscriptionInvoice & {
  plans?: { name: string } | { name: string }[] | null;
};

export default async function SubscriptionPage() {
  const session = await getOwnerSessionFromCookies();
  if (!session) redirect("/login");
  if (!session.company_id) redirect("/onboarding");

  const supabase = createAdminClient();
  const [summary, plansResult, invoicesResult] = await Promise.all([
    getUsageSummary(supabase, session.company_id),
    supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("subscription_invoices")
      .select("*, plans(name)")
      .eq("company_id", session.company_id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <SubscriptionClient
      summary={summary}
      plans={(plansResult.data ?? []) as Plan[]}
      invoices={(invoicesResult.data ?? []) as InvoiceWithPlan[]}
    />
  );
}
