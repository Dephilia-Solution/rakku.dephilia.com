import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets, getOwnerEmployees } from "@/lib/supabase/queries.owner";
import { createAdminClient } from "@rakku/db";
import { OwnerDashboardView } from "@/components/owner/OwnerDashboardView";

export default async function OwnerDashboardPage() {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return null;
  const [outlets, employees] = await Promise.all([getOwnerOutlets(session.company_id), getOwnerEmployees(session.company_id)]);
  const supabase = createAdminClient();
  const outletIds = outlets.map(row => row.id);
  let totalRevenue = 0, totalTransactions = 0;
  if (outletIds.length) {
    const { data: orders } = await supabase.from("orders").select("total_price, status").eq("company_id", session.company_id).in("outlet_id", outletIds).eq("status", "completed");
    totalTransactions = orders?.length ?? 0;
    totalRevenue = (orders ?? []).reduce((sum, row) => sum + Number(row.total_price || 0), 0);
  }
  return <OwnerDashboardView owner={session} outlets={outlets} employees={employees} totalRevenue={totalRevenue} totalTransactions={totalTransactions}
    activeOutlets={outlets.filter(row => row.status === "active").length} activeEmployees={employees.filter(row => row.status === "active").length} />;
}
