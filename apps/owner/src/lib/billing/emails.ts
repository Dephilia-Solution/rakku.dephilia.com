import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@rakku/echo-client";
import { renderRakkuEmail } from "@/lib/email-templates";

export interface BillingEmailInput {
  companyId: string;
  type: string;
  period: string;
  subject: string;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  note?: string;
}

interface OwnerContact {
  email: string;
  name: string;
}

async function getOwnerContact(
  supabase: SupabaseClient,
  companyId: string
): Promise<OwnerContact | null> {
  const { data } = await supabase
    .from("companies")
    .select("owner_id, owners(email, name)")
    .eq("id", companyId)
    .maybeSingle();

  const ownerRaw = data?.owners as unknown;
  const owner = (Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw) as
    | { email?: string; name?: string }
    | undefined;

  if (!owner?.email) return null;
  return { email: owner.email, name: owner.name ?? "Owner" };
}

/**
 * Kirim email billing dengan klaim idempotent di `notification_logs`
 * (UNIQUE company_id + type + period). Return true bila email terkirim.
 */
export async function sendBillingEmail(
  supabase: SupabaseClient,
  input: BillingEmailInput
): Promise<boolean> {
  const { data: claimed } = await supabase
    .from("notification_logs")
    .upsert(
      { company_id: input.companyId, type: input.type, period: input.period },
      { onConflict: "company_id,type,period", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();

  if (!claimed) return false;

  const contact = await getOwnerContact(supabase, input.companyId);
  if (!contact) {
    await supabase.from("notification_logs").delete().eq("id", claimed.id);
    return false;
  }

  const baseUrl = process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000";

  const html = renderRakkuEmail({
    eyebrow: input.eyebrow,
    title: input.title,
    paragraphs: input.paragraphs,
    ctaLabel: input.ctaLabel ?? "Buka Langganan",
    ctaUrl: input.ctaUrl ?? `${baseUrl}/subscription`,
    note:
      input.note ??
      "Email ini dikirim otomatis terkait langganan Rakku Anda.",
  });

  try {
    await sendEmail({
      to: contact.email,
      subject: input.subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("[billing-email] gagal kirim:", input.type, err);
    // Lepas klaim agar bisa dicoba lagi pada cron berikutnya.
    await supabase.from("notification_logs").delete().eq("id", claimed.id);
    return false;
  }
}
