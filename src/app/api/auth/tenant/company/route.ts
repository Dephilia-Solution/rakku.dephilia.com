import { NextRequest, NextResponse } from "next/server";
import { verifyCompanyLogin } from "@/lib/auth/company";
import { signPendingLogin, setPendingLoginCookie } from "@/lib/auth/pending-login";

export async function POST(request: NextRequest) {
  const { code, password } = await request.json();

  if (!code || !password) {
    return NextResponse.json(
      { error: "Kode perusahaan dan password harus diisi" },
      { status: 400 }
    );
  }

  const { company, error } = await verifyCompanyLogin(code.toUpperCase(), password);

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
