import { NextResponse } from "next/server";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { createAdminClient } from "@/lib/db";
import { getUsageSummary } from "@rakku/plans";

export async function GET() {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const summary = await getUsageSummary(supabase, session.company_id);

  return NextResponse.json({ summary });
}
