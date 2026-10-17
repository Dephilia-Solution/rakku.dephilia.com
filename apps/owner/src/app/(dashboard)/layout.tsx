import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/db";
import { getUsageSummary } from "@rakku/plans";
import OwnerShell from "@/components/layout/OwnerShell";

export const dynamic = "force-dynamic";

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

  return <OwnerShell owner={ownerData} summary={summary}>{children}</OwnerShell>;
}
