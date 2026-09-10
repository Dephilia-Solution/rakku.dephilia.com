import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { getUsageSummary } from "@rakku/plans";
import ResponsiveNav from "@/components/layout/ResponsiveNav";
import DashboardContent from "@/components/layout/DashboardContent";
import PlanProvider from "@/components/billing/PlanProvider";
import PlanBanner from "@/components/billing/PlanBanner";
import { ToastContainer } from "@rakku/ui";

export default async function OwnerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOwnerSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, code, logo_url")
    .eq("owner_id", session.owner_id)
    .maybeSingle();

  if (!company) {
    redirect("/onboarding");
  }

  const ownerData = {
    name: session.name,
    email: session.email,
    companyName: company.name,
    companyCode: company.code,
  };

  const summary = await getUsageSummary(supabase, company.id);

  return (
    <PlanProvider summary={summary}>
      <div className="flex min-h-dvh overflow-hidden bg-neutral-50">
        <ResponsiveNav owner={ownerData} />
        <DashboardContent>
          <PlanBanner />
          {children}
        </DashboardContent>
        <ToastContainer />
      </div>
    </PlanProvider>
  );
}
