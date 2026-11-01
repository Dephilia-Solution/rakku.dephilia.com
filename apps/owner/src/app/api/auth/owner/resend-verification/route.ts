import { guardOwnerAuth } from "@/lib/auth/request-guard";
import { NextRequest, NextResponse } from "next/server";
import { getOwnerByEmail } from "@/lib/supabase/queries.owner";
import { sendEmail } from "@rakku/echo-client";
import { renderRakkuEmail } from "@rakku/emails";
import { signVerification } from "@/lib/auth/verification";

export async function POST(request: NextRequest) {
  const denied = await guardOwnerAuth(request); if (denied) return denied;
  const body = await request.json().catch(() => null);

  if (typeof body?.email !== "string" || body.email.length > 254) {
    return NextResponse.json({ error: "Email harus diisi" }, { status: 400 });
  }

  const { owner, error } = await getOwnerByEmail(body.email.toLowerCase());

  if (error || !owner || owner.email_verified_at || !owner.is_active) {
    return NextResponse.json({ message: "Jika akun membutuhkan verifikasi, email akan dikirim." });
  }

  const token = await signVerification(owner);

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

  return NextResponse.json({ message: "Jika akun membutuhkan verifikasi, email akan dikirim." });
}
