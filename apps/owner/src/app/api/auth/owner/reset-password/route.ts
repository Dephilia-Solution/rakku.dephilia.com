import { NextRequest, NextResponse } from "next/server";
import {
  getOwnerByValidResetToken,
  clearOwnerResetToken,
  updateOwnerPassword,
} from "@/lib/supabase/queries.owner";
import { hashResetToken } from "@/lib/auth/reset-token";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !body.token || !body.password) {
    return NextResponse.json(
      { error: "Token dan password baru harus diisi" },
      { status: 400 }
    );
  }

  const token = String(body.token);
  const password = String(body.password);

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password minimal 8 karakter" },
      { status: 400 }
    );
  }

  const tokenHash = hashResetToken(token);
  const { owner, error } = await getOwnerByValidResetToken(tokenHash);

  if (error || !owner) {
    return NextResponse.json(
      { error: "Token tidak valid atau sudah kadaluarsa" },
      { status: 400 }
    );
  }

  const { error: updateErr } = await updateOwnerPassword(owner.id, password);
  if (updateErr) {
    return NextResponse.json({ error: updateErr }, { status: 500 });
  }

  await clearOwnerResetToken(owner.id);

  return NextResponse.json({ message: "Kata sandi berhasil diperbarui" });
}
