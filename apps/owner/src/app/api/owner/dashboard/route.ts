import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { readOwnerDashboardAnalytics } from "@rakku/db/owner-dashboard";
import { getCompanyPlan } from "@rakku/plans";
import { isOwnerDashboardRange } from "@rakku/shared-types";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";

export async function GET(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const query = request.nextUrl.searchParams, range = query.get("range") ?? "today";
  const outletId = query.get("outlet_id") || "all";
  if (!isOwnerDashboardRange(range) || (outletId !== "all" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(outletId))) {
    return NextResponse.json({ error: "Filter dashboard tidak valid" }, { status: 400 });
  }
  const db = createAdminClient();
  const { plan } = await getCompanyPlan(db, session.company_id);
  try {
    const analytics = await readOwnerDashboardAnalytics(db, {
      companyId: session.company_id, range, outletId,
      reportHistoryDays: plan.report_history_days, inventoryAdvanced: Boolean(plan.features.inventory_advanced),
    });
    return NextResponse.json(analytics, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "Dashboard outlet not found") {
      return NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 404 });
    }
    throw error;
  }
}
