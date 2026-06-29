import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearSessionCookie } from "@/lib/auth/tenant-session";
import { clearPendingLoginCookie } from "@/lib/auth/pending-login";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
  response.headers.set(
    "Set-Cookie",
    [clearSessionCookie(), clearPendingLoginCookie()].join(", "),
  );
  return response;
}
