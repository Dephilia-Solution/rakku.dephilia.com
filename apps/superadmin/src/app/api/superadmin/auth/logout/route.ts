import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@rakku/supabase-clients/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });

  response.cookies.getAll().forEach((cookie) => {
    response.cookies.delete(cookie.name);
  });

  return response;
}
