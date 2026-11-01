import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/db";
import { readOwnerDashboardAnalytics } from "@rakku/db/owner-dashboard";
import { getOwnerUsage } from "@/lib/owner-data";
import { OwnerDashboardView } from "@/components/owner/OwnerDashboardView";

export default async function OwnerDashboardPage() {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return null;
  const { plan } = await getOwnerUsage(session.company_id);
  const analytics = await readOwnerDashboardAnalytics(createAdminClient(), { companyId: session.company_id,
    range: "today", reportHistoryDays: plan.report_history_days, inventoryAdvanced: Boolean(plan.features.inventory_advanced) });
  return <OwnerDashboardView owner={session} initialAnalytics={analytics} />;
}
