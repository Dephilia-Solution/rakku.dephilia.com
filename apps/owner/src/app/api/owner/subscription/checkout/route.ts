import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { createQrisPayment } from "@rakku/vessel-client";
import { generateInvoiceNumber } from "@/lib/billing/subscription";
import type { OwnerSession } from "@rakku/shared-types";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

export async function POST(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const planSlug = body?.plan_slug;
  const billingCycle = body?.billing_cycle === "yearly" ? "yearly" : "monthly";

  if (!planSlug) {
    return NextResponse.json({ error: "plan_slug wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("slug", String(planSlug))
    .eq("is_active", true)
    .maybeSingle();

  if (!plan) {
    return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
  }

  if (plan.slug === "free") {
    return NextResponse.json(
      { error: "Paket Free tidak memerlukan pembayaran" },
      { status: 400 }
    );
  }

  const amount = Number(
    billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly
  );

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Harga paket tidak valid" }, { status: 400 });
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, code")
    .eq("id", session.company_id)
    .maybeSingle();

  const invoiceNumber = generateInvoiceNumber(company?.code ?? "RAKKU");
  const ownerBase = process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000";

  let payment;
  try {
    payment = await createQrisPayment({
      tenant_id: session.company_id,
      invoice_number: invoiceNumber,
      amount,
      expired_in_minutes: 60,
      callback_url: `${ownerBase}/api/webhooks/vessel`,
    });
  } catch (err) {
    console.error("[subscription/checkout] gagal membuat QRIS:", err);
    return NextResponse.json(
      { error: "Gagal membuat pembayaran QRIS. Coba lagi." },
      { status: 502 }
    );
  }

  const { data: invoice, error } = await supabase
    .from("subscription_invoices")
    .insert({
      company_id: session.company_id,
      plan_id: plan.id,
      billing_cycle: billingCycle,
      invoice_number: invoiceNumber,
      amount,
      provider: "vessel",
      provider_transaction_id: payment.transaction_id,
      qr_string: payment.qr_string,
      status: "pending",
      expired_at: payment.expired_at,
      raw_payload: payment,
    })
    .select()
    .single();

  if (error || !invoice) {
    console.error("[subscription/checkout] gagal simpan invoice:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan invoice. Coba lagi." },
      { status: 500 }
    );
  }

  return NextResponse.json({ invoice }, { status: 201 });
}
