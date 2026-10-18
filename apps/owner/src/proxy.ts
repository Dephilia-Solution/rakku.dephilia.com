import { type NextRequest, NextResponse } from "next/server";
import { correlationId } from "@rakku/observability";
import { verifyOwnerSession } from "@/lib/auth/session-token";

// Proxy checks token purpose and request origin. Authoritative registry/ownership
// checks remain in server layouts and API guards.
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", correlationId(request.headers.get("x-request-id")));
  if (["/api/auth/", "/api/owner/", "/api/onboarding/"].some(p => pathname.startsWith(p)) && !["GET", "HEAD", "OPTIONS"].includes(request.method)
    && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (pathname.startsWith("/api/")) return NextResponse.next({ request: { headers: requestHeaders } });
  // Login remains reachable when a still-signed session has been disabled in DB.
  if (["/login", "/register"].includes(pathname)) return NextResponse.next({ request: { headers: requestHeaders } });
  const token = request.cookies.get("owner_session")?.value;
  const session = token ? await verifyOwnerSession(token) : null;
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/outlets/:path*", "/employees/:path*",
    "/settings/:path*", "/reports/:path*", "/orders/:path*", "/pricing-tiers/:path*",
    "/taxes/:path*", "/discounts/:path*", "/subscription/:path*", "/balance/:path*", "/login", "/register", "/api/:path*"],
};
