import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { findSuperadminInvite, activateSuperadminInvite } from "@rakku/db/invitations";
import { getAuth } from "@/lib/auth/server";
import { isAllowedSuperadminOrigin } from "@/lib/auth/origins";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || (origin !== new URL(request.url).origin && !isAllowedSuperadminOrigin(origin))) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (typeof body?.token !== "string" || typeof body?.password !== "string" ||
    body.password.length < 12 || body.password.length > 128 || typeof body?.name !== "string" ||
    !body.name.trim() || body.name.length > 100) {
    return NextResponse.json({ error: "Nama dan password minimal 12 karakter wajib diisi" }, { status: 400 });
  }
  const db = createAdminClient();
  const invite = await findSuperadminInvite(db, body.token);
  if (!invite) return NextResponse.json({ error: "Undangan kedaluwarsa atau sudah digunakan" }, { status: 400 });
  try {
    const auth = getAuth();
    await auth.signUp.email({ email: invite.email, password: body.password, name: body.name.trim() });
    // Always prove credential ownership. Some Better Auth configurations return
    // a synthetic signup user for existing emails to prevent enumeration.
    // This also recovers Auth creation followed by an interrupted DB activation.
    const result = await auth.signIn.email({ email: invite.email, password: body.password });
    if (result.error || !result.data?.user) {
      return NextResponse.json({ error: "Verifikasi email jika diminta, lalu coba lagi dengan password akun Anda." }, { status: 400 });
    }
    await activateSuperadminInvite(db, body.token, result.data.user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[superadmin] invitation activation failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Aktivasi gagal. Coba lagi atau hubungi pengelola." }, { status: 400 });
  }
}
