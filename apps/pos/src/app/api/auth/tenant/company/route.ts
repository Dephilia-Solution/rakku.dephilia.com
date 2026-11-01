import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { getPendingLoginFromCookies } from "@/lib/auth/pending-login";
import { allowAuthAttempt } from "@rakku/db/sessions";
import { createAdminClient } from "@rakku/db";
import { NextRequest, NextResponse } from "next/server";
import { verifyCompanyLogin } from "@/lib/auth/company";
import { setPendingLoginCookie } from "@/lib/auth/pending-login";

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  if (realIp) return realIp;
  if (cfConnectingIp) return cfConnectingIp;

  return request.headers.get("host") || "unknown";
}

export async function POST(request: NextRequest) {
  if (await getTenantSessionFromCookies()) return NextResponse.json({ error: "Sesi sudah aktif", redirect: "/register" }, { status: 409 });
  if (await getPendingLoginFromCookies()) return NextResponse.json({ error: "Selesaikan login atau logout terlebih dahulu" }, { status: 409 });
  const { code, password } = await request.json();

  if (typeof code !== "string" || typeof password !== "string" || code.length > 64 || password.length > 72) {
    return NextResponse.json(
      { error: "Kode perusahaan dan password harus diisi" },
      { status: 400 }
    );
  }

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || undefined;

  const db = createAdminClient();
  if (!await allowAuthAttempt(db, `company:${code.toUpperCase()}`, 10, 900)
    || !await allowAuthAttempt(db, `company-ip:${ipAddress}`, 30, 900)) return NextResponse.json({ error: "Terlalu banyak percobaan" }, { status: 429 });
  const result = await verifyCompanyLogin(
    code.toUpperCase(),
    password,
    ipAddress,
    userAgent
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { company, pendingLoginToken } = result;

  return NextResponse.json(
    { company_name: company.name, company_id: company.id },
    {
      status: 200,
      headers: { "Set-Cookie": setPendingLoginCookie(pendingLoginToken) },
    }
  );
}
