import { sql, type DatabaseClient } from "@rakku/db";
import {
  getPaymentStatus,
  type VesselPaymentDetail,
} from "@rakku/vessel-client";
import type { SubscriptionInvoice } from "@rakku/shared-types";
import { sendBillingEmail } from "@rakku/emails";

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
  supabase: DatabaseClient,
  invoice: SubscriptionInvoice,
  detail: VesselPaymentDetail
): Promise<boolean> {
  const paidAt = detail.paid_at ? new Date(detail.paid_at) : new Date();
  if (detail.invoice_number !== invoice.invoice_number || Number(detail.amount) !== Number(invoice.amount)) {
    throw new Error("Provider payment does not match the subscription invoice");
  }
  const activation = await supabase.transaction(async supabase => {
  await supabase.execute(sql`select id from public.companies where id=${invoice.company_id} for update`);

  // Atomic claim: hanya invoice berstatus pending yang boleh diaktifkan.
  // Webhook & polling yang berjalan bersamaan tidak akan double-aktivasi.
  const { data: claimed, error: claimError } = await supabase
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

  if (claimError) throw new Error(claimError.message);
  if (!claimed) return null;

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

  const subscription = await supabase.from("subscriptions").insert({
    company_id: invoice.company_id,
    plan_id: invoice.plan_id,
    status: "active",
    started_at: paidAt.toISOString(),
    current_period_start: base.toISOString(),
    current_period_end: periodEnd.toISOString(),
  });
  if (subscription.error) throw new Error(subscription.error.message);

  const companyUpdate = await supabase
    .from("companies")
    .update({
      plan_id: invoice.plan_id,
      subscription_status: "active",
      plan_expires_at: periodEnd.toISOString(),
      billing_cycle: invoice.billing_cycle,
    })
    .eq("id", invoice.company_id);
  if (companyUpdate.error) throw new Error(companyUpdate.error.message);

  const { data: plan } = await supabase
    .from("plans")
    .select("name")
    .eq("id", invoice.plan_id)
    .maybeSingle();
  return { periodEnd, planName: plan?.name ?? "langganan" };
  });
  if (!activation) return false;
  const { periodEnd, planName } = activation;

  try {
  await sendBillingEmail(supabase, {
    companyId: invoice.company_id,
    type: "payment_success",
    period: invoice.invoice_number,
    subject: `Pembayaran diterima — Paket ${planName} aktif`,
    eyebrow: "Langganan",
    title: "Pembayaran diterima.",
    paragraphs: [
      `Paket ${planName} Anda aktif sampai ${periodEnd.toLocaleDateString("id-ID")}.`,
      `Invoice ${invoice.invoice_number} sebesar Rp${Number(invoice.amount).toLocaleString("id-ID")} sudah kami terima.`,
    ],
    note: "Terima kasih. Langganan dapat diperpanjang kapan saja dari halaman Langganan.",
  });
  } catch (error) { console.error("[billing] post-commit email failed", error); }

  return true;
}

/**
 * Sinkronkan status invoice ke Vessel lalu aktivasi bila sudah dibayar.
 * Selalu re-verify ke Vessel — payload webhook tidak pernah dipercaya langsung.
 * `statusFetcher` dapat di-inject untuk pengujian.
 */
export async function processInvoice(
  supabase: DatabaseClient,
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
