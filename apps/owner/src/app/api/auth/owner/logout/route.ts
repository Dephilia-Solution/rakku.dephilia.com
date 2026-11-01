import { NextRequest, NextResponse } from "next/server";
import { clearOwnerSessionCookie, verifyOwnerSession } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/db";
import { revokeSession } from "@rakku/db/sessions";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("owner_session")?.value;
  const session = token ? await verifyOwnerSession(token) : null;
  if (session) await revokeSession(createAdminClient(), session.session_id);
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
  response.headers.set("Set-Cookie", clearOwnerSessionCookie());
  return response;
}
