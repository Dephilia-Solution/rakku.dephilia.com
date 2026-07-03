import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";

export async function GET() {
  const session = await getTenantSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: productDiscounts, error: pdError } = await supabase
    .from("product_discounts")
    .select("*")
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .eq("is_active", true)
    .lte("start_date", now)
    .gte("end_date", now);

  if (pdError) {
    return NextResponse.json({ error: pdError.message }, { status: 500 });
  }

  const { data: orderDiscounts, error: odError } = await supabase
    .from("order_discounts")
    .select("*")
    .eq("company_id", session.company_id)
    .eq("outlet_id", session.outlet_id)
    .eq("is_active", true)
    .lte("start_date", now)
    .gte("end_date", now);

  if (odError) {
    return NextResponse.json({ error: odError.message }, { status: 500 });
  }

  return NextResponse.json({
    productDiscounts: productDiscounts ?? [],
    orderDiscounts: orderDiscounts ?? [],
  });
}
