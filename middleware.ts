import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { verifySession } from "@/lib/auth/tenant-session";

const tenantAuthPaths = ["/login", "/login/select-outlet", "/login/select-user", "/login/enter-pin"];
const superadminPaths = ["/superadmin"];
const dashboardPaths = ["/register", "/orders", "/reports", "/admin"];

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

  // ---- TENANT AUTH ROUTES (login flow) ----
  if (tenantAuthPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    // Allow all login pages through
    return supabaseResponse;
  }

  // ---- SUPERADMIN ROUTES ----
  if (pathname.startsWith("/superadmin")) {
    if (pathname === "/superadmin/login") {
      // Check if already logged in
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

    // Protected superadmin routes
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

  // ---- DASHBOARD / TENANT ROUTES (protected) ----
  if (dashboardPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const sessionToken = request.cookies.get("session")?.value;
    if (!sessionToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const session = await verifySession(sessionToken);
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Check menu access for dashboard pages
    // Allow admin prefix for products page
    const menuSlug = pathname.startsWith("/admin") ? "products" : pathname.split("/")[1];

    // We'll do a lightweight check using a fetch to avoid DB in middleware
    // For the middleware, we just verify the session exists
    // Full access control happens in the page/layout layer

    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
