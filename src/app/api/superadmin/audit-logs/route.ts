import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Unauthorized");
  return data.user;
}

/**
 * GET /api/superadmin/audit-logs
 *
 * Fetch audit logs with optional filters.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireSuperadmin();
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("company_id");
    const eventType = searchParams.get("event_type");
    const success = searchParams.get("success");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Build base query
    let query = supabase
      .from("auth_audit_logs")
      .select("*");

    // Apply filters
    if (companyId && companyId !== "all") {
      query = query.eq("company_id", companyId);
    }
    if (eventType && eventType !== "all") {
      query = query.eq("event_type", eventType);
    }
    if (success && success !== "all") {
      query = query.eq("success", success === "true");
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      query = query.lt("created_at", endDateObj.toISOString());
    }

    // Execute query
    const { data: logs, error } = await query
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("[AuditLogsAPI] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // If no logs, return empty array early
    if (!logs || logs.length === 0) {
      return NextResponse.json([]);
    }

    // Collect all unique IDs for batch fetching
    const companyIds = [...new Set(logs.map((l) => l.company_id).filter((id): id is string => !!id))];
    const userIds = [...new Set(logs.map((l) => l.user_id).filter((id): id is string => !!id))];
    const outletIds = [...new Set(logs.map((l) => l.outlet_id).filter((id): id is string => !!id))];

    // Fetch related data in parallel
    const [companiesResult, usersResult, outletsResult] = await Promise.allSettled([
      companyIds.length > 0
        ? supabase.from("companies").select("id, name").in("id", companyIds)
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabase.from("users").select("id, name").in("id", userIds)
        : Promise.resolve({ data: [] }),
      outletIds.length > 0
        ? supabase.from("outlets").select("id, name").in("id", outletIds)
        : Promise.resolve({ data: [] }),
    ]);

    const companiesData =
      companiesResult.status === "fulfilled" ? companiesResult.value.data || [] : [];
    const usersData =
      usersResult.status === "fulfilled" ? usersResult.value.data || [] : [];
    const outletsData =
      outletsResult.status === "fulfilled" ? outletsResult.value.data || [] : [];

    // Create lookup maps
    const companyMap = new Map(companiesData.map((c: any) => [c.id, c.name]));
    const userMap = new Map(usersData.map((u: any) => [u.id, u.name]));
    const outletMap = new Map(outletsData.map((o: any) => [o.id, o.name]));

    // Enrich logs with related names
    const enrichedLogs = logs.map((log) => ({
      ...log,
      companies: log.company_id ? { name: companyMap.get(log.company_id) || null } : null,
      users: log.user_id ? { name: userMap.get(log.user_id) || null } : null,
      outlets: log.outlet_id ? { name: outletMap.get(log.outlet_id) || null } : null,
    }));

    return NextResponse.json(enrichedLogs);
  } catch (error) {
    console.error("[AuditLogsAPI] Auth error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}
