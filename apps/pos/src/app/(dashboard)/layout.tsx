import { redirect } from "next/navigation";
import ResponsiveNav from "@/components/layout/ResponsiveNav";
import DashboardContent from "@/components/layout/DashboardContent";
import PlanProvider from "@/components/billing/PlanProvider";
import LimitBanner from "@/components/billing/LimitBanner";
import { ToastContainer } from "@rakku/ui";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { getAllowedMenus } from "@/lib/auth/menus";
import { createAdminClient } from "@rakku/supabase-clients";
import { getUsageSummary } from "@rakku/plans";
import type { Menu } from "@rakku/shared-types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getTenantSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  let menus: Menu[] = [];
  try {
    menus = await getAllowedMenus(session.role_id);
  } catch {
    // If DB query fails, just use empty menus
  }

  const summary = await getUsageSummary(
    createAdminClient(),
    session.company_id
  );

  const upgradeUrl = `${
    process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000"
  }/subscription`;

  const lockedPaths = summary.features?.inventory_advanced
    ? []
    : ["/purchases"];

  return (
    <PlanProvider summary={summary} upgradeUrl={upgradeUrl}>
      <div className="flex min-h-dvh overflow-hidden">
        <ResponsiveNav menus={menus} lockedPaths={lockedPaths} />
        <DashboardContent>
          <LimitBanner />
          {children}
        </DashboardContent>
        <ToastContainer />
      </div>
    </PlanProvider>
  );
}
