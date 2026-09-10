import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import {
  createCompanyWithOnboarding,
  generateCompanyCode,
  generateSlug,
} from "@/lib/supabase/queries.owner";
import { sendBillingEmail } from "@/lib/billing/emails";
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
  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { companyName, companyCode, companyPassword, outletName, outletAddress } =
    body;

  if (!companyName || !companyPassword || !outletName) {
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

  // Gunakan kode yang diinput atau generate dari nama
  const code = (companyCode || generateCompanyCode(companyName)).toUpperCase();

  const { company, error } = await createCompanyWithOnboarding({
    ownerId: session.owner_id,
    companyName,
    companyCode: code,
    companyPassword,
    outletName,
    outletAddress,
  });

  if (error || !company) {
    return NextResponse.json({ error }, { status: 400 });
  }

  // Email trial Pro dimulai (idempotent, tidak menggagalkan onboarding).
  try {
    const supabase = createAdminClient();
    const { data: trialCompany } = await supabase
      .from("companies")
      .select("trial_ends_at")
      .eq("id", company.id)
      .maybeSingle();

    const trialEndsAt = trialCompany?.trial_ends_at as string | undefined;
    await sendBillingEmail(supabase, {
      companyId: company.id,
      type: "trial_started",
      period: trialEndsAt?.slice(0, 10) ?? "start",
      subject: "Trial Pro 14 hari aktif — selamat datang di Rakku",
      eyebrow: "Langganan",
      title: `Selamat datang, ${session.name}.`,
      paragraphs: [
        "Trial Pro 14 hari Anda sudah aktif. Semua fitur Pro — laba rugi, pembelian, opname, role custom — bisa dicoba sekarang.",
        trialEndsAt
          ? `Trial berakhir pada ${new Date(trialEndsAt).toLocaleDateString("id-ID")}. Setelah itu akun otomatis turun ke paket Free.`
          : "Setelah trial berakhir, akun otomatis turun ke paket Free.",
      ],
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
      redirect: "/owner",
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

  const name = request.nextUrl.searchParams.get("name") || "";
  return NextResponse.json({
    code: generateCompanyCode(name),
    slug: generateSlug(name),
  });
}
