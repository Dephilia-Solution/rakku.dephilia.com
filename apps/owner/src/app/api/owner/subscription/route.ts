import { NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { getUsageSummary } from "@rakku/plans";

export async function GET() {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();
  const [summary, plansResult] = await Promise.all([
    getUsageSummary(supabase, session.company_id),
    supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  return NextResponse.json({
    summary,
    plans: plansResult.data ?? [],
  });
}
