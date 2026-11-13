import { guardOwnerAuth } from "@/lib/auth/request-guard";
import { NextRequest, NextResponse } from "next/server";
import { createOwner } from "@/lib/supabase/queries.owner";
import { sendEmail } from "@rakku/echo-client";
import { renderRakkuEmail } from "@rakku/emails";
import { signVerification } from "@/lib/auth/verification";

export async function POST(request: NextRequest) {
  const denied = await guardOwnerAuth(request); if (denied) return denied;
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { name, email, password } = body;

  if (typeof name !== "string" || !name.trim() || name.length > 100 || typeof email !== "string" || email.length > 254 || typeof password !== "string") {
    return NextResponse.json(
      { error: "Nama, email, dan password harus diisi" },
      { status: 400 }
    );
  }

  if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
    return NextResponse.json(
      { error: "Password minimal 8 karakter dan maksimal 72 byte" },
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

  const { owner, error, code, status } = await createOwner({
    name,
    email,
    password,
    phone: body.phone,
  });

  if (error || !owner) {
    return NextResponse.json({ error, code }, { status: status ?? 400 });
  }

  const token = await signVerification(owner);

  const verifyUrl = `${process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000"}/api/auth/owner/verify-email?token=${token}`;

  const html = renderRakkuEmail({
    eyebrow: "Verifikasi Email",
    title: `Selangkah lagi, ${name}.`,
    paragraphs: [
      "Terima kasih sudah bergabung bersama Rakku. Konfirmasikan alamat email Anda untuk menyelesaikan pendaftaran dan mulai menyusun transaksi di rak Anda.",
    ],
    ctaLabel: "Verifikasi Email",
    ctaUrl: verifyUrl,
    note: "Tombol verifikasi berlaku selama 1 jam. Jika Anda tidak merasa mendaftar di Rakku, Anda dapat mengabaikan email ini.",
  });

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
