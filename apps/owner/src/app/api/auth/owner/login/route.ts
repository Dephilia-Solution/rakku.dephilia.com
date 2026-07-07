import { NextRequest, NextResponse } from "next/server";
import { getOwnerByEmail } from "@/lib/supabase/queries.owner";
import { signOwnerSession, setOwnerSessionCookie } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import bcrypt from "bcryptjs";
import type { OwnerSession } from "@rakku/shared-types";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email dan password harus diisi" },
      { status: 400 }
    );
  }

  const { owner, error } = await getOwnerByEmail(email.toLowerCase());

  if (error || !owner) {
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  }

  if (!owner.is_active) {
    return NextResponse.json({ error: "Akun dinonaktifkan" }, { status: 403 });
  }

  if (!owner.email_verified_at) {
    return NextResponse.json(
      {
        error: "Email belum diverifikasi. Silakan cek inbox email Anda.",
        need_verify: true,
      },
      { status: 403 }
    );
  }

  const valid = await bcrypt.compare(password, owner.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  }

  // Update last_login_at
  const supabase = createAdminClient();
  await supabase
    .from("owners")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", owner.id);

  const session: OwnerSession = {
    owner_id: owner.id,
    email: owner.email,
    name: owner.name,
    company_id: owner.company_id,
    company_name: owner.company_name,
    company_slug: owner.company_slug,
  };

  const token = await signOwnerSession(session);

  return NextResponse.json(
    {
      owner: { id: owner.id, email: owner.email, name: owner.name },
      redirect: owner.company_id ? "/" : "/onboarding",
    },
    {
      headers: { "Set-Cookie": setOwnerSessionCookie(token) },
    }
  );
}
