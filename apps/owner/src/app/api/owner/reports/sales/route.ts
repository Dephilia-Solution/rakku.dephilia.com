import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { readOwnerSalesReport } from "@rakku/db/owner-dashboard";
import { getCompanyPlan } from "@rakku/plans";
import { jakartaDayStart, jakartaRangeBounds, type ReportRange } from "@rakku/shared-types";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";

const ranges = new Set(["today", "yesterday", "week", "month", "all"]);

export async function GET(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const query = request.nextUrl.searchParams;
  const range = query.get("range") ?? "today";
  const page = Number(query.get("page") ?? 1);
  const outletId = query.get("outlet_id") || undefined;
  if (!ranges.has(range) || !Number.isSafeInteger(page) || page < 1 || page > 100_000
    || (outletId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(outletId))) {
    return NextResponse.json({ error: "Filter laporan tidak valid" }, { status: 400 });
  }
  const db = createAdminClient();
  const now = new Date();
  const plan = await getCompanyPlan(db, session.company_id);
  const bounds = jakartaRangeBounds(range as ReportRange, now);
  const historyDays = plan.plan.report_history_days;
  if (historyDays >= 0) {
    const cutoff = new Date(jakartaDayStart(now).getTime() - Math.max(0, historyDays - 1) * 86_400_000).toISOString();
    if (!bounds.start || bounds.start < cutoff) bounds.start = cutoff;
  }
  const result = await readOwnerSalesReport(db, { companyId: session.company_id, outletId, start: bounds.start, end: bounds.end, page });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
