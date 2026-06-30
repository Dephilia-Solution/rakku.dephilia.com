import { NextRequest, NextResponse } from "next/server";
import { verifyCompanyLogin } from "@/lib/auth/company";
import { signPendingLogin, setPendingLoginCookie } from "@/lib/auth/pending-login";

/**
 * Extracts the client IP address from various headers.
 * Checks X-Forwarded-For, X-Real-IP, and CF-Connecting-IP headers.
 */
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
  const { code, password } = await request.json();

  if (!code || !password) {
    return NextResponse.json(
      { error: "Kode perusahaan dan password harus diisi" },
      { status: 400 }
    );
  }

  // Extract IP and User Agent for audit logging
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || undefined;

  const { company, error } = await verifyCompanyLogin(
    code.toUpperCase(),
    password,
    ipAddress,
    userAgent
  );

  if (error || !company) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const token = await signPendingLogin({
    company_id: company.id,
    company_name: company.name,
  });

  return NextResponse.json(
    { company_name: company.name, company_id: company.id },
    {
      status: 200,
      headers: { "Set-Cookie": setPendingLoginCookie(token) },
    }
  );
}
