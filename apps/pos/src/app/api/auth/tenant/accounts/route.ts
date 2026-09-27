import { NextRequest, NextResponse } from "next/server";
import { getPendingLoginFromCookies } from "@/lib/auth/pending-login";
import { getAccountsForOutlet } from "@/lib/auth/company";
import { logAuthEvent } from "@rakku/auth-utils";
import { createAdminClient } from "@rakku/supabase-clients";

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  if (realIp) return realIp;
  if (cfConnectingIp) return cfConnectingIp;

  return request.headers.get("host") || "unknown";
}

export async function GET(request: NextRequest) {
  const pending = await getPendingLoginFromCookies();

  if (!pending || !pending.outlet_id) {
    return NextResponse.json({ error: "Sesi login tidak ditemukan" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const accounts = await getAccountsForOutlet(pending.outlet_id, pending.company_id);

  await logAuthEvent(supabase, {
    company_id: pending.company_id,
    outlet_id: pending.outlet_id,
    user_id: null,
    event_type: "account_select",
    success: true,
    ip_address: getClientIp(request),
    user_agent: request.headers.get("user-agent") || undefined,
    metadata: { action: "list_accounts", count: accounts.length },
  });

  return NextResponse.json({ accounts, outlet_name: pending.outlet_name });
}
