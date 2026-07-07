import { type NextRequest, NextResponse } from "next/server";
import { verifyOwnerSession } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";

const ownerAuthPaths = ["/register", "/login"];
const ownerOnboardingPath = "/onboarding";
const ownerDashboardPaths = ["/dashboard", "/outlets", "/employees", "/settings"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next({ request });

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return response;
  }

  if (ownerAuthPaths.some((p) => pathname === p)) {
    const ownerToken = request.cookies.get("owner_session")?.value;
    if (ownerToken) {
      const session = await verifyOwnerSession(ownerToken);
      if (session) {
        const supabase = createAdminClient();
        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", session.owner_id)
          .maybeSingle();

        const redirectUrl = company ? "/dashboard" : "/onboarding";
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
    }
    return response;
  }

  if (pathname === ownerOnboardingPath) {
    const ownerToken = request.cookies.get("owner_session")?.value;
    if (!ownerToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const session = await verifyOwnerSession(ownerToken);
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const supabase = createAdminClient();
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", session.owner_id)
      .maybeSingle();

    if (company) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  if (pathname === "/" || ownerDashboardPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const ownerToken = request.cookies.get("owner_session")?.value;
    if (!ownerToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const session = await verifyOwnerSession(ownerToken);
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const supabase = createAdminClient();
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", session.owner_id)
      .maybeSingle();

    if (!company) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
