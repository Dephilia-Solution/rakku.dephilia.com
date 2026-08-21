import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import ResponsiveNav from "@/components/layout/ResponsiveNav";
import DashboardContent from "@/components/layout/DashboardContent";
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

  return (
    <div className="flex min-h-dvh overflow-hidden bg-neutral-50">
      <ResponsiveNav owner={ownerData} />
      <DashboardContent>{children}</DashboardContent>
      <ToastContainer />
    </div>
  );
}
