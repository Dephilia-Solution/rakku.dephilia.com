import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, verifySession } from "@/lib/auth/tenant-session";
import { clearPendingLoginCookie, getPendingLoginFromCookies } from "@/lib/auth/pending-login";
import { revokeSession } from "@rakku/db/sessions";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { logAuthEvent } from "@rakku/auth-utils";
import { createAdminClient } from "@rakku/db";

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

export async function POST(request: NextRequest) {
  const session = await getTenantSessionFromCookies();
  const db = createAdminClient();
  const token = request.cookies.get("session")?.value;
  const signed = token ? await verifySession(token) : null;
  const pending = await getPendingLoginFromCookies();
  await revokeSession(db, signed?.session_id);
  await revokeSession(db, pending?.session_id);
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || undefined;

  if (session) {
    const supabase = createAdminClient();
    await logAuthEvent(supabase, {
      company_id: session.company_id,
      outlet_id: session.outlet_id,
      user_id: session.user_id,
      event_type: "shift_end",
      success: true,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        user_name: session.user_name,
        company_name: session.company_name,
        outlet_name: session.outlet_name,
      },
    });
  }

  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
  response.headers.append("Set-Cookie", clearSessionCookie());
  response.headers.append("Set-Cookie", clearPendingLoginCookie());
  return response;
}
