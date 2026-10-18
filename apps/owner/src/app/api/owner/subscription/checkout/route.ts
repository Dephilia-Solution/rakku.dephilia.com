import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/db";
import { createQrisPayment } from "@rakku/vessel-client";
import {
  markSubscriptionProviderAccepted,
  markSubscriptionProviderUncertain,
  reserveSubscriptionInvoice,
  SubscriptionBillingError,
} from "@rakku/db/subscription-billing";
import { generateInvoiceNumber } from "@/lib/billing/subscription";
import type { OwnerSession } from "@rakku/shared-types";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return null;
  return session as OwnerWithCompany;
}

function failure(error: unknown) {
  if (error instanceof SubscriptionBillingError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: "Gagal membuat pembayaran" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Anda belum memiliki perusahaan" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const planSlug = body?.plan_slug;
  const billingCycle = body?.billing_cycle === "yearly" ? "yearly" : "monthly";
  const requestId = typeof body?.requestId === "string"
    ? body.requestId
    : request.headers.get("idempotency-key");

  if (!planSlug || typeof planSlug !== "string") {
    return NextResponse.json({ error: "plan_slug wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    const { data: plan } = await supabase
      .from("plans")
      .select("*")
      .eq("slug", planSlug)
      .eq("is_active", true)
      .maybeSingle();
    if (!plan) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
    if (plan.slug === "free") {
      return NextResponse.json({ error: "Paket Free tidak memerlukan pembayaran" }, { status: 400 });
    }

    const amount = Number(billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "Harga paket tidak valid" }, { status: 400 });
    }

    const { data: company } = await supabase
      .from("companies")
      .select("id, code")
      .eq("id", session.company_id)
      .maybeSingle();
    if (!company) return NextResponse.json({ error: "Perusahaan tidak ditemukan" }, { status: 404 });

    const reserved = await reserveSubscriptionInvoice(supabase, {
      companyId: session.company_id,
      planId: plan.id,
      billingCycle,
      amount,
      invoiceNumber: generateInvoiceNumber(company.code ?? "RAKKU"),
      requestId,
    });

    if (!reserved.canCreateProvider) {
      const uncertain = ["creating", "unknown"].includes(reserved.invoice.provider_state);
      return NextResponse.json({
        invoice: reserved.invoice,
        reused: true,
        ...(uncertain ? {
          code: "PROVIDER_UNCERTAIN",
          warning: "Pembuatan QRIS belum dapat dipastikan. Invoice dipertahankan; jangan membuat pembayaran pengganti.",
        } : {}),
      }, { status: uncertain ? 202 : 200 });
    }

    const ownerBase = process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000";
    try {
      const payment = await createQrisPayment({
        tenant_id: session.company_id,
        invoice_number: reserved.invoice.invoice_number,
        amount,
        expired_in_minutes: 60,
        callback_url: `${ownerBase}/api/webhooks/vessel`,
      });
      if (payment.tenant_id !== session.company_id) {
        throw new Error("Tenant provider tidak cocok");
      }
      const accepted = await markSubscriptionProviderAccepted(supabase, reserved.invoice.id, {
        transaction_id: payment.transaction_id,
        invoice_number: payment.invoice_number,
        qr_string: payment.qr_string,
        expired_at: payment.expired_at,
        amount: (payment as unknown as { amount?: string | number }).amount,
      });
      return NextResponse.json({ invoice: accepted, reused: reserved.reused }, {
        status: reserved.reused ? 200 : 201,
      });
    } catch {
      const uncertain = await markSubscriptionProviderUncertain(
        supabase,
        reserved.invoice.id,
        new Error("Provider create belum terkonfirmasi"),
      );
      return NextResponse.json({
        invoice: uncertain ?? reserved.invoice,
        code: "PROVIDER_UNCERTAIN",
        warning: "Pembuatan QRIS belum dapat dipastikan. Invoice dipertahankan untuk rekonsiliasi; jangan membuat pembayaran pengganti.",
      }, { status: 202 });
    }
  } catch (error) {
    return failure(error);
  }
}
