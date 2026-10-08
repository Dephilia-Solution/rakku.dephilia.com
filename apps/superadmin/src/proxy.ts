import { type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

export async function proxy(request: NextRequest) {
  // Session gate only; authoritative allowlist checks live in layouts/API routes.
  return getAuth().middleware({ loginUrl: "/login" })(request);
}

export const config = {
  matcher: ["/((?!api|login|activate|reset-password|_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
