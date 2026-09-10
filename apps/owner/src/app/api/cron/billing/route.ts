import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/supabase-clients";
import {
  getUsageSummary,
  GRACE_DAYS,
  PLAN_LIMIT_KEYS,
} from "@rakku/plans";
import { processInvoice } from "@/lib/billing/subscription";
import { sendBillingEmail } from "@/lib/billing/emails";
import type { PlanLimitKey, SubscriptionInvoice } from "@rakku/shared-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 24 * 60 * 60 * 1000;

const LIMIT_LABEL: Record<PlanLimitKey, string> = {
  outlets: "outlet",
  employees: "karyawan",
  products: "produk",
  ingredients: "bahan baku",
  transactions: "transaksi bulan ini",
};

const LIMIT_KEYS: PlanLimitKey[] = [...PLAN_LIMIT_KEYS];

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return request.headers.get("x-cron-secret") === secret;
}

async function run(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dry = request.nextUrl.searchParams.get("dry") === "1";
  const supabase = createAdminClient();
  const now = Date.now();
  const baseUrl = process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000";

  const result = {
    synced: 0,
    activated: 0,
    trialReminders: 0,
    trialExpired: 0,
    renewalReminders: 0,
    subscriptionExpired: 0,
    limitWarnings: 0,
  };

  // 1. Sinkronkan invoice pending (re-verify ke Vessel + aktivasi bila sukses)
  const { data: pendingInvoices } = await supabase
    .from("subscription_invoices")
    .select("*")
    .eq("status", "pending")
    .limit(100);

  for (const invoice of pendingInvoices ?? []) {
    const processed = await processInvoice(
      supabase,
      invoice as SubscriptionInvoice
    );
    result.synced++;
    if (processed.activated) result.activated++;
  }

  // 2. Siklus trial & langganan + peringatan kuota
  const { data: companies } = await supabase
    .from("companies")
    .select(
      "id, name, subscription_status, trial_ends_at, plan_expires_at"
    )
    .not("plan_id", "is", null);

  if (dry) {
    return NextResponse.json({ ok: true, dry: true, result });
  }

  for (const company of companies ?? []) {
    const companyId = company.id as string;
    const status = (company.subscription_status as string) ?? "active";

    if (status === "trial" && company.trial_ends_at) {
      const end = new Date(company.trial_ends_at).getTime();
      const period = String(company.trial_ends_at).slice(0, 10);

      if (end <= now) {
        await supabase
          .from("companies")
          .update({ subscription_status: "expired" })
          .eq("id", companyId);

        const sent = await sendBillingEmail(supabase, {
          companyId,
          type: "trial_ended",
          period,
          subject: "Trial Pro Anda telah berakhir",
          eyebrow: "Langganan",
          title: "Trial Pro berakhir.",
          paragraphs: [
            "Masa trial Pro 14 hari Anda sudah selesai. Akun kini berjalan dengan paket Free.",
            "Semua data tetap aman. Upgrade kapan saja untuk membuka kembali fitur Pro.",
          ],
          note: "Paket Free tetap bisa dipakai untuk operasional harian dengan batas yang berlaku.",
        });
        if (sent) result.trialExpired++;
      } else if (end - now <= 3 * DAY) {
        const sent = await sendBillingEmail(supabase, {
          companyId,
          type: "trial_h3",
          period,
          subject: "Trial Pro Anda tersisa 3 hari",
          eyebrow: "Langganan",
          title: "Trial Pro hampir berakhir.",
          paragraphs: [
            "Trial Pro Anda tinggal beberapa hari lagi. Setelah berakhir, akun otomatis turun ke paket Free.",
            "Upgrade sekarang agar laporan laba rugi, pembelian, dan opname tetap berjalan.",
          ],
          note: "Pembayaran QRIS — paket aktif otomatis setelah pembayaran berhasil.",
        });
        if (sent) result.trialReminders++;
      }
    }

    if (status === "active" && company.plan_expires_at) {
      const end = new Date(company.plan_expires_at).getTime();
      const daysLeft = Math.ceil((end - now) / DAY);
      const period = String(company.plan_expires_at).slice(0, 10);

      if (end <= now) {
        const graceEnd = end + GRACE_DAYS * DAY;
        if (now > graceEnd) {
          await supabase
            .from("companies")
            .update({ subscription_status: "expired" })
            .eq("id", companyId);

          const sent = await sendBillingEmail(supabase, {
            companyId,
            type: "subscription_expired",
            period,
            subject: "Langganan Rakku berakhir",
            eyebrow: "Langganan",
            title: "Langganan berakhir.",
            paragraphs: [
              "Masa tenggang langganan Anda sudah selesai. Akun kini berjalan dengan paket Free.",
              "Data tetap aman dan dapat diakses. Perpanjang kapan saja untuk mengaktifkan kembali fitur Pro.",
            ],
          });
          if (sent) result.subscriptionExpired++;
        } else {
          await sendBillingEmail(supabase, {
            companyId,
            type: "subscription_grace",
            period,
            subject: "Masa tenggang langganan Rakku",
            eyebrow: "Langganan",
            title: "Langganan Anda dalam masa tenggang.",
            paragraphs: [
              `Langganan sudah lewat tanggal berakhir. Masa tenggang berlaku ${GRACE_DAYS} hari sebelum akun turun ke paket Free.`,
              "Perpanjang sekarang untuk menghindari penguncian fitur Pro.",
            ],
          });
        }
      } else if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1) {
        const sent = await sendBillingEmail(supabase, {
          companyId,
          type: `renewal_h${daysLeft}`,
          period,
          subject: `Langganan Rakku berakhir dalam ${daysLeft} hari`,
          eyebrow: "Langganan",
          title: `Sisa ${daysLeft} hari lagi.`,
          paragraphs: [
            `Langganan paket Anda berakhir pada ${new Date(
              company.plan_expires_at
            ).toLocaleDateString("id-ID")}.`,
            "Perpanjang sekarang agar operasional tidak terganggu.",
          ],
        });
        if (sent) result.renewalReminders++;
      }
    }

    // Peringatan kuota (80% / 100%) — satu email per bulan per company.
    const usage = await getUsageSummary(supabase, companyId);
    let hitKey: PlanLimitKey | null = null;
    let hitUsed = 0;
    let hitMax = 0;
    let hitLevel: "limit_80" | "limit_100" = "limit_80";

    for (const key of LIMIT_KEYS) {
      const max = usage.limits[key];
      if (max <= 0) continue;
      const used = usage.usage[key];
      if (used >= max) {
        hitKey = key;
        hitUsed = used;
        hitMax = max;
        hitLevel = "limit_100";
        break;
      }
      if (!hitKey && used >= Math.floor(max * 0.8)) {
        hitKey = key;
        hitUsed = used;
        hitMax = max;
        hitLevel = "limit_80";
      }
    }

    if (hitKey) {
      const nowDate = new Date();
      const period = `${nowDate.getFullYear()}-${String(
        nowDate.getMonth() + 1
      ).padStart(2, "0")}`;

      const sent = await sendBillingEmail(supabase, {
        companyId,
        type: hitLevel,
        period,
        subject:
          hitLevel === "limit_100"
            ? `Kuota ${LIMIT_LABEL[hitKey]} paket ${usage.plan.name} habis`
            : `Kuota ${LIMIT_LABEL[hitKey]} hampir penuh`,
        eyebrow: "Kuota Paket",
        title:
          hitLevel === "limit_100"
            ? "Kuota paket Anda habis."
            : "Kuota paket hampir penuh.",
        paragraphs: [
          `Pemakaian ${LIMIT_LABEL[hitKey]} bulan ini: ${hitUsed} dari ${hitMax}.`,
          hitLevel === "limit_100"
            ? "Upgrade paket untuk menambah kuota dan membuka kembali fitur Pro."
            : "Upgrade sebelum kuota habis agar operasional tidak terganggu.",
        ],
        ctaUrl: `${baseUrl}/subscription`,
      });
      if (sent) result.limitWarnings++;
    }
  }

  return NextResponse.json({ ok: true, result });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
