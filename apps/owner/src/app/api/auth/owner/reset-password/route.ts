import { NextRequest, NextResponse } from "next/server";
import { guardOwnerAuth } from "@/lib/auth/request-guard";
import { createAdminClient } from "@rakku/db";
import { consumeOwnerPasswordReset } from "@rakku/db/owner-security";
import { hashResetToken } from "@/lib/auth/reset-token";
import bcrypt from "bcryptjs";
export async function POST(request: NextRequest) {
  const denied = await guardOwnerAuth(request); if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (typeof body?.token !== "string" || typeof body?.password !== "string" || body.password.length < 8 || new TextEncoder().encode(body.password).length > 72) {
    return NextResponse.json({ error: "Token dan password 8–72 karakter wajib diisi" }, { status: 400 });
  }
  const passwordHash = await bcrypt.hash(body.password, 12);
  try {
    await consumeOwnerPasswordReset(createAdminClient(), hashResetToken(body.token), passwordHash);
    return NextResponse.json({ message: "Kata sandi berhasil diperbarui. Silakan login kembali." });
  } catch {
    return NextResponse.json({ error: "Token tidak valid atau sudah kadaluarsa" }, { status: 400 });
  }
}
