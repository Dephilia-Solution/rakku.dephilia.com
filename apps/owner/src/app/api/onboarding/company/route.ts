import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/db";
import {
  checkCompanyCodeAvailability,
  createCompanyWithOnboarding,
  generateCompanyCode,
  generateSlug,
} from "@/lib/supabase/queries.owner";
import { isValidCompanyCode, normalizeCompanyCode } from "@/lib/company-code";
import { sendBillingEmail } from "@rakku/emails";
import { formatPromotionDate } from "@rakku/shared-types";
import {
  signOwnerSession,
  setOwnerSessionCookie,
} from "@/lib/auth/owner-session";

export async function POST(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { error: "Anda harus login sebagai owner" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  if (session.company_id) return NextResponse.json({ error: "Onboarding sudah selesai", redirect: "/" }, { status: 409 });
  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { companyName, companyCode, companyPassword, outletName, outletAddress } =
    body;

  if (
    typeof companyName !== "string" ||
    typeof companyPassword !== "string" ||
    typeof outletName !== "string" ||
    !companyName.trim() ||
    !companyPassword ||
    !outletName.trim()
  ) {
    return NextResponse.json(
      { error: "Nama perusahaan, password, dan nama outlet harus diisi" },
      { status: 400 }
    );
  }

  if (companyPassword.length < 6) {
    return NextResponse.json(
      { error: "Password perusahaan minimal 6 karakter" },
      { status: 400 }
    );
  }

  const code = normalizeCompanyCode(
    typeof companyCode === "string" && companyCode.trim()
      ? companyCode
      : generateCompanyCode(companyName),
  );
  if (!isValidCompanyCode(code)) {
    return NextResponse.json(
      { error: "Kode perusahaan hanya boleh berisi huruf dan angka (1–32 karakter)." },
      { status: 400 },
    );
  }

  const availability = await checkCompanyCodeAvailability(code);
  if (availability.error) {
    return NextResponse.json({ error: availability.error }, { status: 503 });
  }
  if (!availability.available) {
    return NextResponse.json(
      { error: "Kode perusahaan sudah digunakan. Silakan pilih kode lain." },
      { status: 409 },
    );
  }

  const { company, error, promotion, status: serviceStatus, code: serviceCode } = await createCompanyWithOnboarding({
    ownerId: session.owner_id,
    companyName,
    companyCode: code,
    companyPassword,
    outletName,
    outletAddress,
  });

  if (error || !company) {
    const status = serviceStatus ?? (error?.toLowerCase().includes("kode perusahaan sudah digunakan") ? 409 : 400);
    return NextResponse.json({ error, code: serviceCode }, { status });
  }

  // Email reflects the entitlement actually awarded; no permanent 14-day claim.
  try {
    const supabase = createAdminClient();
    const hasBenefit = promotion?.active === true;
    await sendBillingEmail(supabase, {
      companyId: company.id,
      type: hasBenefit ? "trial_started" : "welcome_free",
      period: promotion?.endsAt.slice(0, 10) ?? "start",
      subject: hasBenefit ? `Akses ${promotion.planName} gratis ${promotion.durationMonths} bulan aktif — Rakku` : "Selamat datang di Rakku",
      eyebrow: "Langganan",
      title: `Selamat datang, ${session.name}.`,
      paragraphs: hasBenefit ? [
        `Anda mendapatkan akses ${promotion.planName} gratis ${promotion.durationMonths} bulan kalender sejak pendaftaran akun pada ${formatPromotionDate(promotion.startsAt)}.`,
        `Akses gratis berakhir pada ${formatPromotionDate(promotion.endsAt)} WIB, bukan pada batas pendaftaran promo. Setelah itu akun otomatis menggunakan paket Free kecuali telah berlangganan.`,
      ] : ["Usaha Anda sudah siap menggunakan paket Free Rakku. Pilih paket berlangganan kapan saja jika membutuhkan fitur atau kuota tambahan."],
      note: "Data Anda tetap aman di paket Free. Upgrade kapan saja untuk kembali ke Pro.",
    });
  } catch (err) {
    console.error("[onboarding] gagal kirim email trial:", err);
  }

  // Update session dengan info company baru
  const newToken = await signOwnerSession({
    owner_id: session.owner_id,
    email: session.email,
    name: session.name,
    company_id: company.id,
    company_name: company.name,
    company_slug: company.slug,
  });

  return NextResponse.json(
    {
      company: { id: company.id, name: company.name, code: company.code },
      redirect: "/",
    },
    {
      status: 201,
      headers: { "Set-Cookie": setOwnerSessionCookie(newToken) },
    }
  );
}

// GET: suggest kode & slug dari nama company
export async function GET(request: NextRequest) {
  const session = await getOwnerSessionFromCookies();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const requestedCode = request.nextUrl.searchParams.get("code");
  if (requestedCode !== null) {
    const code = normalizeCompanyCode(requestedCode);
    if (!isValidCompanyCode(code)) {
      return NextResponse.json(
        { error: "Kode perusahaan hanya boleh berisi huruf dan angka (1–32 karakter)." },
        { status: 400 },
      );
    }
    const availability = await checkCompanyCodeAvailability(code);
    if (availability.error) {
      return NextResponse.json({ error: availability.error }, { status: 503 });
    }
    return NextResponse.json({ code, available: availability.available });
  }

  const name = request.nextUrl.searchParams.get("name") || "";
  return NextResponse.json({
    code: generateCompanyCode(name),
    slug: generateSlug(name),
  });
}
