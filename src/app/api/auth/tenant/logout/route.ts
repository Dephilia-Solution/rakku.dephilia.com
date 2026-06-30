import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/tenant-session";
import { clearPendingLoginCookie } from "@/lib/auth/pending-login";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { logAuthEvent } from "@/lib/auth/audit-log";

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
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || undefined;

  // Get session info for logging before clearing
  const session = await getTenantSessionFromCookies();

  if (session) {
    // Log the logout event
    await logAuthEvent({
      company_id: session.company_id,
      outlet_id: session.outlet_id,
      user_id: session.user_id,
      event_type: "logout",
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
  response.headers.set(
    "Set-Cookie",
    [clearSessionCookie(), clearPendingLoginCookie()].join(", "),
  );
  return response;
}
