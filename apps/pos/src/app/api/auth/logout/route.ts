import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/tenant-session";
import { clearPendingLoginCookie } from "@/lib/auth/pending-login";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
  response.headers.set(
    "Set-Cookie",
    [clearSessionCookie(), clearPendingLoginCookie()].join(", "),
  );
  return response;
}
