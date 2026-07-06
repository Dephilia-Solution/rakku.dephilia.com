import { NextRequest, NextResponse } from "next/server";
import { clearOwnerSessionCookie } from "@/lib/auth/owner-session";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/owner/masuk", request.url), {
    status: 303,
  });
  response.headers.set("Set-Cookie", clearOwnerSessionCookie());
  return response;
}
