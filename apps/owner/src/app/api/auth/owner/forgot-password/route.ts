import { NextRequest, NextResponse } from "next/server";
import { getOwnerByEmail, setOwnerResetToken } from "@/lib/supabase/queries.owner";
import { sendEmail } from "@/lib/email";
import { generateResetToken } from "@/lib/auth/reset-token";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !body.email) {
    return NextResponse.json({ error: "Email harus diisi" }, { status: 400 });
  }

  const email = String(body.email).toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
  }

  const { owner, error } = await getOwnerByEmail(email);

  if (!error && owner) {
    const { token, tokenHash, expiresAt } = generateResetToken();
    const { error: setErr } = await setOwnerResetToken(owner.id, tokenHash, expiresAt);

    if (!setErr) {
      const resetUrl = `${process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000"}/reset-password?token=${token}`;
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-size: 24px; color: #1a2e1a; margin: 0;">Rakku</h1>
  </div>
  <h2 style="font-size: 20px; color: #1a1a1a; margin: 0 0 8px;">Reset Kata Sandi</h2>
  <p style="color: #666; margin: 0 0 24px;">Halo ${owner.name}, kami menerima permintaan untuk mengatur ulang kata sandi akun Rakku Anda. Klik tombol di bawah untuk membuat kata sandi baru.</p>
  <a href="${resetUrl}" style="display: inline-block; background: #1a2e1a; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">Atur Ulang Kata Sandi</a>
  <p style="color: #999; font-size: 13px; margin: 24px 0 0;">Link ini berlaku selama 1 jam. Jika Anda tidak merasa meminta reset, abaikan email ini — kata sandi Anda tetap aman.</p>
</body>
</html>`;
      try {
        await sendEmail({
          to: email,
          subject: "Reset Kata Sandi — Rakku POS",
          html,
        });
      } catch {
        // sengaja diabaikan: anti-enumeration. Response tetap 200.
      }
    }
  }

  return NextResponse.json({
    message: "Jika email terdaftar, link reset telah dikirim.",
  });
}
