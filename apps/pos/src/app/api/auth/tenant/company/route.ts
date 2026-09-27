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
  const { code, password } = await request.json();

  if (!code || !password) {
    return NextResponse.json(
      { error: "Kode perusahaan dan password harus diisi" },
      { status: 400 }
    );
  }

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || undefined;

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
