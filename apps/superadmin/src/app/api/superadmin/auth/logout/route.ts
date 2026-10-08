import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/server";
import { isAllowedSuperadminOrigin } from "@/lib/auth/origins";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || (origin !== new URL(request.url).origin && !isAllowedSuperadminOrigin(origin))) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  await getAuth().signOut();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
