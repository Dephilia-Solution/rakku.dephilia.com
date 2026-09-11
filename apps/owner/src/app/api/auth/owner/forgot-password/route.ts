import { NextRequest, NextResponse } from "next/server";
import { getOwnerByEmail, setOwnerResetToken } from "@/lib/supabase/queries.owner";
import { sendEmail } from "@rakku/echo-client";
import { renderRakkuEmail } from "@rakku/emails";
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

  if (error || !owner) {
    return NextResponse.json(
      { error: "Tidak ada akun dengan email ini." },
      { status: 404 }
    );
  }

  const { token, tokenHash, expiresAt } = generateResetToken();
  const { error: setErr } = await setOwnerResetToken(owner.id, tokenHash, expiresAt);

  if (setErr) {
    console.error(
      "[forgot-password] gagal menyimpan token reset untuk",
      email,
      "→",
      setErr
    );
    return NextResponse.json(
      { error: "Gagal memproses permintaan reset. Coba lagi." },
      { status: 500 }
    );
  }

  const resetUrl = `${process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  const html = renderRakkuEmail({
    eyebrow: "Keamanan Akun",
    title: `Atur ulang kata sandi, ${owner.name}.`,
    paragraphs: [
      "Kami menerima permintaan untuk mengatur ulang kata sandi akun Rakku Anda. Klik tombol di bawah untuk membuat kata sandi baru.",
    ],
    ctaLabel: "Atur Ulang Kata Sandi",
    ctaUrl: resetUrl,
    note: "Tombol ini berlaku selama 1 jam. Jika Anda tidak merasa meminta reset, abaikan email ini — kata sandi Anda tetap aman.",
  });

  try {
    await sendEmail({
      to: email,
      subject: "Reset Kata Sandi — Rakku POS",
      html,
    });
  } catch (sendErr) {
    console.error("[forgot-password] gagal kirim email reset:", sendErr);
    return NextResponse.json(
      { error: "Gagal mengirim email reset. Coba lagi nanti." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    message: `Link reset telah dikirim ke ${email}. Cek inbox atau folder spam Anda.`,
  });
}
