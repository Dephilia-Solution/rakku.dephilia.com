import { getOrders } from "@/lib/supabase/queries.server";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { createAdminClient } from "@/lib/db";
import { getCompanyPlan } from "@rakku/plans";
import { jakartaDayStart } from "@rakku/shared-types";
import ReportsClient from "./ReportsClient";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function ReportsPage() {
  const session = await getTenantSessionFromCookies();
  const plan = session ? await getCompanyPlan(createAdminClient(), session.company_id) : null;
  const cutoff = plan && plan.plan.report_history_days >= 0
    ? new Date(jakartaDayStart(new Date()).getTime() - Math.max(0, plan.plan.report_history_days - 1) * DAY_MS)
    : null;
  const orders = await getOrders({ since: cutoff?.toISOString() });

  return <ReportsClient orders={orders} />;
}
