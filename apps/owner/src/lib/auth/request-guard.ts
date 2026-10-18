import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "./owner-session";
import { allowAuthAttempt } from "@rakku/db/sessions";
import { createAdminClient } from "@rakku/db";
export async function guardOwnerAuth(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (session) return NextResponse.json({ error: "Sesi sudah aktif", redirect: session.company_id ? "/" : "/onboarding" }, { status: 409 });
  const body = await request.clone().json().catch(() => null);
  const identity = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const db = createAdminClient();
  const path = request.nextUrl.pathname;
  if (!await allowAuthAttempt(db, `${path}:ip:${ip}`, 30, 900)
    || (identity && !await allowAuthAttempt(db, `${path}:email:${identity}`, 10, 900))) {
    return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi dalam 15 menit." }, { status: 429 });
  }
  return null;
}
