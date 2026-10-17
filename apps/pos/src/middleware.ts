import { type NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session-token";

const tenantAuthPaths = ["/login", "/login/select-outlet", "/login/select-user", "/login/enter-pin"];
const dashboardPaths = ["/register", "/orders", "/reports", "/products", "/tax-discounts"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set("x-rakku-path", pathname);
  // Always overwrite client-supplied route metadata before server capability checks.
  headers.delete("x-rakku-api-path");
  headers.delete("x-rakku-api-method");
  if (pathname.startsWith("/api/admin/") || pathname.startsWith("/api/reports/")) {
    const token = request.cookies.get("session")?.value;
    if (!token || !await verifySession(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.headers.get("origin") !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }
    headers.set("x-rakku-api-path", pathname);
    headers.set("x-rakku-api-method", request.method);
  }
  const supabaseResponse = NextResponse.next({ request: { headers } });

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
