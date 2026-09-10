import { NextRequest, NextResponse } from "next/server";
import { getOwnerByEmail } from "@/lib/supabase/queries.owner";
import { sendEmail } from "@rakku/echo-client";
import { renderRakkuEmail } from "@/lib/email-templates";
import { SignJWT } from "jose";

const VERIFY_SECRET = new TextEncoder().encode(
  process.env.OWNER_JWT_SECRET || "dev-secret-change-in-production-min-32-chars!!"
);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || !body.email) {
    return NextResponse.json({ error: "Email harus diisi" }, { status: 400 });
  }

  const { owner, error } = await getOwnerByEmail(body.email.toLowerCase());

  if (error || !owner) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  if (owner.email_verified_at) {
    return NextResponse.json({ error: "Email sudah diverifikasi" }, { status: 400 });
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

  const html = renderRakkuEmail({
    eyebrow: "Verifikasi Email",
    title: `Selangkah lagi, ${owner.name}.`,
    paragraphs: [
      "Terima kasih sudah bergabung bersama Rakku. Konfirmasikan alamat email Anda untuk menyelesaikan pendaftaran dan mulai menyusun transaksi di rak Anda.",
    ],
    ctaLabel: "Verifikasi Email",
    ctaUrl: verifyUrl,
    note: "Tombol verifikasi berlaku selama 1 jam. Jika Anda tidak merasa mendaftar di Rakku, Anda dapat mengabaikan email ini.",
  });

  try {
    await sendEmail({
      to: owner.email,
      subject: "Verifikasi Email — Rakku POS",
      html,
    });
  } catch {
    return NextResponse.json({ error: "Gagal mengirim email" }, { status: 500 });
  }

  return NextResponse.json({ message: "Email verifikasi telah dikirim" });
}
