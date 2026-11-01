import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerUsage } from "@/lib/owner-data";
import { getOwnerOutlets } from "@/lib/supabase/queries.owner";
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

  if (!session.company_id) {
    redirect("/onboarding");
  }

  const ownerData = {
    name: session.name,
    email: session.email,
    companyName: session.company_name ?? "",
    companyCode: session.company_code ?? "",
  };

  const [summary, outlets] = await Promise.all([
    getOwnerUsage(session.company_id),
    getOwnerOutlets(session.company_id),
  ]);

  return (
    <OwnerShell owner={ownerData} summary={summary} outlets={outlets} cacheScope={`${session.owner_id}:${session.company_id}:${session.session_id}`}>
      {children}
    </OwnerShell>
  );
}
