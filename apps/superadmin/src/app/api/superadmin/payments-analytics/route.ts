import { NextResponse } from "next/server";
import { readPlatformPaymentAnalytics } from "@rakku/db/platform-analytics";
import { jakartaDayStart, jakartaRangeBounds } from "@rakku/shared-types";
import { createClient } from "@/lib/auth/database";

export async function GET() {
  let db;
  try { db = await createClient(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const now = new Date();
  const startToday = jakartaDayStart(now).getTime();
  const data = await readPlatformPaymentAnalytics(db, {
    monthStart: jakartaRangeBounds("month", now).start!,
    since: new Date(startToday - 13 * 86_400_000).toISOString(),
    end: new Date(startToday + 86_400_000).toISOString(),
  });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
