import { NextRequest, NextResponse } from "next/server";
import { consumeVerification } from "@/lib/auth/verification";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
export async function GET(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (session) return NextResponse.redirect(new URL(session.company_id ? "/" : "/onboarding", request.url));
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
  try {
    await consumeVerification(token);
    // Confirmation never replaces the browser identity; authenticate with the password.
    return NextResponse.redirect(new URL("/login?verified=1", request.url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
  }
}
