import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { verifySession } from "@/lib/auth/tenant-session";
import { verifyOwnerSession } from "@/lib/auth/owner-session";
import { createAdminClient } from "@/lib/supabase/admin";

const tenantAuthPaths = ["/login", "/login/select-outlet", "/login/select-user", "/login/enter-pin"];
const superadminPaths = ["/superadmin"];
const dashboardPaths = ["/register", "/orders", "/reports", "/products", "/categories", "/pricing-tiers", "/taxes", "/discounts"];
const ownerAuthPaths = ["/owner/daftar", "/owner/masuk"];
const ownerOnboardingPaths = ["/owner/onboarding"];
const ownerDashboardPaths = ["/owner/outlets", "/owner/employees", "/owner/settings"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let supabaseResponse = NextResponse.next({ request });

  // Public / static routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return supabaseResponse;
  }

  // ---- TENANT AUTH ROUTES (login flow kasir) ----
  if (tenantAuthPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return supabaseResponse;
  }

  // ---- OWNER AUTH ROUTES (daftar, masuk) ----
  if (ownerAuthPaths.some((p) => pathname === p)) {
    // Jika sudah login owner → redirect ke /owner
    const ownerToken = request.cookies.get("owner_session")?.value;
    if (ownerToken) {
      const session = await verifyOwnerSession(ownerToken);
      if (session) {
        // Cek apakah sudah punya company
        const supabase = createAdminClient();
        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", session.owner_id)
          .maybeSingle();

        const redirectUrl = company ? "/owner" : "/owner/onboarding";
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
    }
    return supabaseResponse;
  }

  // ---- OWNER ONBOARDING ROUTE ----
  if (ownerOnboardingPaths.some((p) => pathname === p)) {
    const ownerToken = request.cookies.get("owner_session")?.value;
    if (!ownerToken) {
      return NextResponse.redirect(new URL("/owner/masuk", request.url));
    }
    const session = await verifyOwnerSession(ownerToken);
    if (!session) {
      return NextResponse.redirect(new URL("/owner/masuk", request.url));
    }

    // Jika sudah punya company → redirect ke /owner
    const supabase = createAdminClient();
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", session.owner_id)
      .maybeSingle();

    if (company) {
      return NextResponse.redirect(new URL("/owner", request.url));
    }
    return supabaseResponse;
  }

  // ---- OWNER DASHBOARD ROUTE (/owner dan sub-routes) ----
  if (pathname === "/owner" || ownerDashboardPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const ownerToken = request.cookies.get("owner_session")?.value;
    if (!ownerToken) {
      return NextResponse.redirect(new URL("/owner/masuk", request.url));
    }
    const session = await verifyOwnerSession(ownerToken);
    if (!session) {
      return NextResponse.redirect(new URL("/owner/masuk", request.url));
    }

    // Jika belum punya company → redirect ke onboarding (kecuali sudah di onboarding)
    const supabase = createAdminClient();
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", session.owner_id)
      .maybeSingle();

    if (!company) {
      return NextResponse.redirect(new URL("/owner/onboarding", request.url));
    }

    return supabaseResponse;
  }

  // ---- SUPERADMIN ROUTES ----
  if (pathname.startsWith("/superadmin")) {
    if (pathname === "/superadmin/login") {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return request.cookies.getAll(); },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
              supabaseResponse = NextResponse.next({ request });
              cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options)
              );
            },
          },
        }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        return NextResponse.redirect(new URL("/superadmin/companies", request.url));
      }
      return supabaseResponse;
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/superadmin/login", request.url));
    }
    return supabaseResponse;
  }

  // ---- DASHBOARD / TENANT ROUTES (kasir, protected) ----
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
