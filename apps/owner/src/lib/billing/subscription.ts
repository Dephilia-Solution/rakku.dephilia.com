import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPaymentStatus,
  type VesselPaymentDetail,
} from "@rakku/vessel-client";
import type { SubscriptionInvoice } from "@rakku/shared-types";
import { sendBillingEmail } from "./emails";

export interface ProcessResult {
  invoice: SubscriptionInvoice;
  activated: boolean;
}

function addPeriod(base: Date, cycle: string): Date {
  const end = new Date(base);
  if (cycle === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

async function activateSubscription(
  supabase: SupabaseClient,
  invoice: SubscriptionInvoice,
  detail: VesselPaymentDetail
): Promise<boolean> {
  const paidAt = detail.paid_at ? new Date(detail.paid_at) : new Date();

  // Atomic claim: hanya invoice berstatus pending yang boleh diaktifkan.
  // Webhook & polling yang berjalan bersamaan tidak akan double-aktivasi.
  const { data: claimed } = await supabase
    .from("subscription_invoices")
    .update({
      status: "success",
      paid_at: paidAt.toISOString(),
      raw_payload: detail as unknown as Record<string, unknown>,
    })
    .eq("id", invoice.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (!claimed) return false;

  const { data: company } = await supabase
    .from("companies")
    .select("id, plan_id, plan_expires_at")
    .eq("id", invoice.company_id)
    .maybeSingle();

  const now = new Date();
  const existingExpiry = company?.plan_expires_at
    ? new Date(company.plan_expires_at)
    : null;

  // Perpanjangan plan yang sama: mulai dari expiry yang masih berlaku.
  const base =
    company?.plan_id === invoice.plan_id &&
    existingExpiry &&
    existingExpiry.getTime() > now.getTime()
      ? existingExpiry
      : now;

  const periodEnd = addPeriod(base, invoice.billing_cycle);

  await supabase.from("subscriptions").insert({
    company_id: invoice.company_id,
    plan_id: invoice.plan_id,
    status: "active",
    started_at: paidAt.toISOString(),
    current_period_start: base.toISOString(),
    current_period_end: periodEnd.toISOString(),
  });

  await supabase
    .from("companies")
    .update({
      plan_id: invoice.plan_id,
      subscription_status: "active",
      plan_expires_at: periodEnd.toISOString(),
      billing_cycle: invoice.billing_cycle,
    })
    .eq("id", invoice.company_id);

  const { data: plan } = await supabase
    .from("plans")
    .select("name")
    .eq("id", invoice.plan_id)
    .maybeSingle();

  await sendBillingEmail(supabase, {
    companyId: invoice.company_id,
    type: "payment_success",
    period: invoice.invoice_number,
    subject: `Pembayaran diterima — Paket ${plan?.name ?? "langganan"} aktif`,
    eyebrow: "Langganan",
    title: "Pembayaran diterima.",
    paragraphs: [
      `Paket ${plan?.name ?? "langganan"} Anda aktif sampai ${periodEnd.toLocaleDateString("id-ID")}.`,
      `Invoice ${invoice.invoice_number} sebesar Rp${Number(invoice.amount).toLocaleString("id-ID")} sudah kami terima.`,
    ],
    note: "Terima kasih. Langganan dapat diperpanjang kapan saja dari halaman Langganan.",
  });

  return true;
}

/**
 * Sinkronkan status invoice ke Vessel lalu aktivasi bila sudah dibayar.
 * Selalu re-verify ke Vessel — payload webhook tidak pernah dipercaya langsung.
 * `statusFetcher` dapat di-inject untuk pengujian.
 */
export async function processInvoice(
  supabase: SupabaseClient,
  invoice: SubscriptionInvoice,
  statusFetcher: (
    transactionId: string
  ) => Promise<VesselPaymentDetail> = getPaymentStatus
): Promise<ProcessResult> {
  if (invoice.status !== "pending") {
    return { invoice, activated: false };
  }

  if (!invoice.provider_transaction_id) {
    return { invoice, activated: false };
  }

  let detail: VesselPaymentDetail;
  try {
    detail = await statusFetcher(invoice.provider_transaction_id);
  } catch {
    return { invoice, activated: false };
  }

  if (detail.payment_status === "success") {
    const activated = await activateSubscription(supabase, invoice, detail);
    return {
      invoice: { ...invoice, status: "success", paid_at: detail.paid_at },
      activated,
    };
  }

  if (
    detail.payment_status === "expired" ||
    detail.payment_status === "failed" ||
    detail.payment_status === "cancelled"
  ) {
    await supabase
      .from("subscription_invoices")
      .update({
        status: detail.payment_status,
        raw_payload: detail as unknown as Record<string, unknown>,
      })
      .eq("id", invoice.id)
      .eq("status", "pending");

    return { invoice: { ...invoice, status: detail.payment_status }, activated: false };
  }

  // Masih pending: tandai expired lokal bila sudah lewat waktu.
  if (invoice.expired_at && new Date(invoice.expired_at).getTime() < Date.now()) {
    await supabase
      .from("subscription_invoices")
      .update({ status: "expired" })
      .eq("id", invoice.id)
      .eq("status", "pending");

    return { invoice: { ...invoice, status: "expired" }, activated: false };
  }

  return { invoice, activated: false };
}

export function generateInvoiceNumber(companyCode: string): string {
  const now = new Date();
  const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  return `RK-${period}-${companyCode.slice(0, 8)}-${stamp}${random}`;
}
