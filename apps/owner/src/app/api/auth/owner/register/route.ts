import { NextRequest, NextResponse } from "next/server";
import { createOwner } from "@/lib/supabase/queries.owner";
import { sendEmail } from "@/lib/email";
import { SignJWT } from "jose";

const VERIFY_SECRET = new TextEncoder().encode(
  process.env.OWNER_JWT_SECRET || "dev-secret-change-in-production-min-32-chars!!"
);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { name, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Nama, email, dan password harus diisi" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password minimal 8 karakter" },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: "Format email tidak valid" },
      { status: 400 }
    );
  }

  const { owner, error } = await createOwner({
    name,
    email,
    password,
    phone: body.phone,
  });

  if (error || !owner) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const token = await new SignJWT({
    owner_id: owner.id,
    email: owner.email,
    name: owner.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(VERIFY_SECRET);

  const verifyUrl = `${process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000"}/api/auth/owner/verify-email?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 24px; color: #1a2e1a; margin: 0;">Rakku</h1>
  </div>
  <h2 style="font-size: 20px; color: #1a1a1a; margin: 0 0 8px;">Verifikasi Email Anda</h2>
  <p style="color: #666; margin: 0 0 24px;">Halo ${name}, klik tombol di bawah untuk verifikasi email dan melanjutkan pendaftaran.</p>
  <a href="${verifyUrl}" style="display: inline-block; background: #1a2e1a; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">Verifikasi Email</a>
  <p style="color: #999; font-size: 13px; margin: 24px 0 0;">Link ini berlaku selama 1 jam. Jika Anda tidak merasa mendaftar, abaikan email ini.</p>
</body>
</html>`;

  try {
    await sendEmail({
      to: email,
      subject: "Verifikasi Email — Rakku POS",
      html,
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal mengirim email verifikasi" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { message: "Email verifikasi telah dikirim" },
    { status: 201 }
  );
}
