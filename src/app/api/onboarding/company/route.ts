import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import {
  createCompanyWithOnboarding,
  generateCompanyCode,
  generateSlug,
} from "@/lib/supabase/queries.owner";
import {
  signOwnerSession,
  setOwnerSessionCookie,
} from "@/lib/auth/owner-session";

export async function POST(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { error: "Anda harus login sebagai owner" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { companyName, companyCode, companyPassword, outletName, outletAddress } =
    body;

  if (!companyName || !companyPassword || !outletName) {
    return NextResponse.json(
      { error: "Nama perusahaan, password, dan nama outlet harus diisi" },
      { status: 400 }
    );
  }

  if (companyPassword.length < 6) {
    return NextResponse.json(
      { error: "Password perusahaan minimal 6 karakter" },
      { status: 400 }
    );
  }

  // Gunakan kode yang diinput atau generate dari nama
  const code = (companyCode || generateCompanyCode(companyName)).toUpperCase();

  const { company, error } = await createCompanyWithOnboarding({
    ownerId: session.owner_id,
    companyName,
    companyCode: code,
    companyPassword,
    outletName,
    outletAddress,
  });

  if (error || !company) {
    return NextResponse.json({ error }, { status: 400 });
  }

  // Update session dengan info company baru
  const newToken = await signOwnerSession({
    owner_id: session.owner_id,
    email: session.email,
    name: session.name,
    company_id: company.id,
    company_name: company.name,
    company_slug: company.slug,
  });

  return NextResponse.json(
    {
      company: { id: company.id, name: company.name, code: company.code },
      redirect: "/owner",
    },
    {
      status: 201,
      headers: { "Set-Cookie": setOwnerSessionCookie(newToken) },
    }
  );
}

// GET: suggest kode & slug dari nama company
export async function GET(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const name = request.nextUrl.searchParams.get("name") || "";
  return NextResponse.json({
    code: generateCompanyCode(name),
    slug: generateSlug(name),
  });
}
