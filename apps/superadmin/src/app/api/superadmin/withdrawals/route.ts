import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/auth/database";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("withdrawals")
      .select("*, companies(name, code)")
      .order("requested_at", { ascending: false })
      .limit(200);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const withdrawals = data ?? [];

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const summary = {
      pendingCount: withdrawals.filter((w) =>
        ["requested", "processing"].includes(w.status as string)
      ).length,
      pendingTotal: withdrawals
        .filter((w) => ["requested", "processing"].includes(w.status as string))
        .reduce((sum, w) => sum + Number(w.amount), 0),
      completedThisMonth: withdrawals
        .filter(
          (w) =>
            w.status === "completed" &&
            w.processed_at &&
            new Date(w.processed_at as string) >= monthStart
        )
        .reduce((sum, w) => sum + Number(w.amount), 0),
    };

    return NextResponse.json({ withdrawals, summary });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
