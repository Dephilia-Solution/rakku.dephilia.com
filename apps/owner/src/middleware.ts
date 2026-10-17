import { type NextRequest, NextResponse } from "next/server";
import { verifyOwnerSession } from "@/lib/auth/session-token";

// Middleware runs at the edge. Database/ownership checks belong to server layouts
// and API guards, not to a TCP Postgres connection here.
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Login remains reachable when a still-signed session has been disabled in DB.
  if (["/login", "/register"].includes(pathname)) return NextResponse.next();
  const token = request.cookies.get("owner_session")?.value;
  const session = token ? await verifyOwnerSession(token) : null;
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/outlets/:path*", "/employees/:path*",
    "/settings/:path*", "/reports/:path*", "/orders/:path*", "/pricing-tiers/:path*",
    "/taxes/:path*", "/discounts/:path*", "/subscription/:path*", "/balance/:path*", "/login", "/register"],
};
