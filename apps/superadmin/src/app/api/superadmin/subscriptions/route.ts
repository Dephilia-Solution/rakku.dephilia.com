import { NextResponse } from "next/server";
import { readPlatformSubscriptionAnalytics } from "@rakku/db/platform-analytics";
import { jakartaRangeBounds } from "@rakku/shared-types";
import { createClient } from "@/lib/auth/database";

export async function GET() {
  let db;
  try { db = await createClient(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const now = new Date();
  const [invoices, totals] = await Promise.all([
    db.from("subscription_invoices")
      .select("id, invoice_number, company_id, amount, billing_cycle, status, created_at, paid_at, companies(name, code), plans(name, slug)")
      .order("created_at", { ascending: false }).limit(200),
    readPlatformSubscriptionAnalytics(db, {
      monthStart: jakartaRangeBounds("month", now).start!,
      thirtyDaysAgo: new Date(now.getTime() - 30 * 86_400_000).toISOString(),
    }),
  ]);
  if (invoices.error) return NextResponse.json({ error: "Gagal memuat invoice" }, { status: 500 });
  return NextResponse.json({ invoices: invoices.data ?? [], ...totals }, { headers: { "Cache-Control": "private, no-store" } });
}
