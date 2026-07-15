import { type NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/tenant-session";

const tenantAuthPaths = ["/login", "/login/select-outlet", "/login/select-user", "/login/enter-pin"];
const dashboardPaths = ["/register", "/orders", "/reports", "/products", "/categories", "/pricing-tiers", "/taxes", "/discounts", "/settings"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let supabaseResponse = NextResponse.next({ request });

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return supabaseResponse;
  }

  if (tenantAuthPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return supabaseResponse;
  }

  if (dashboardPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const sessionToken = request.cookies.get("session")?.value;
    if (!sessionToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const session = await verifySession(sessionToken);
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
