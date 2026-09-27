import type { SupabaseClient } from "@supabase/supabase-js";
import { getBalance, holdBalance } from "@rakku/ledger";
import { sendBillingEmail } from "@rakku/emails";
import type { Withdrawal } from "@rakku/shared-types";
import {
  MAX_PENDING_WITHDRAWALS,
  MIN_WITHDRAWAL,
  WITHDRAWAL_DAILY_LIMIT,
  WITHDRAWAL_FEE,
  formatRupiah,
} from "./withdrawals";

export interface CreateWithdrawalInput {
  companyId: string;
  ownerId: string;
  bankAccountId: string;
  amount: number;
  note?: string | null;
}

export type CreateWithdrawalResult =
  | { withdrawal: Withdrawal }
  | { error: string };

/**
 * Buat pengajuan pencairan + hold saldo (available → pending).
 * Validasi: rekening aktif milik company, min nominal, 1 pending/company,
 * limit harian, dan saldo tersedia cukup.
 */
export async function createWithdrawalRequest(
  supabase: SupabaseClient,
  input: CreateWithdrawalInput
): Promise<CreateWithdrawalResult> {
  const { companyId, ownerId, bankAccountId, amount, note } = input;

  if (!bankAccountId) {
    return { error: "Pilih rekening tujuan" };
  }
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
    return { error: `Minimal pencairan ${formatRupiah(MIN_WITHDRAWAL)}` };
  }

  const { data: account } = await supabase
    .from("merchant_bank_accounts")
    .select("*")
    .eq("id", bankAccountId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  if (!account) {
    return { error: "Rekening tidak ditemukan atau tidak aktif" };
  }

  const { count: pendingCount } = await supabase
    .from("withdrawals")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("status", ["requested", "processing"]);

  if ((pendingCount ?? 0) >= MAX_PENDING_WITHDRAWALS) {
    return { error: "Masih ada pengajuan pencairan yang sedang diproses" };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: todayRows } = await supabase
    .from("withdrawals")
    .select("amount")
    .eq("company_id", companyId)
    .gte("requested_at", startOfDay.toISOString())
    .in("status", ["requested", "processing", "completed"]);

  const todayTotal = (todayRows ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );

  if (todayTotal + amount > WITHDRAWAL_DAILY_LIMIT) {
    return {
      error: `Melebihi batas pencairan harian ${formatRupiah(
        WITHDRAWAL_DAILY_LIMIT
      )}`,
    };
  }

  const balance = await getBalance(supabase, companyId);
  if (balance.available_balance < amount) {
    return { error: "Saldo tersedia tidak mencukupi" };
  }

  const fee = WITHDRAWAL_FEE;
  const netAmount = amount - fee;

  const { data: withdrawal, error } = await supabase
    .from("withdrawals")
    .insert({
      company_id: companyId,
      bank_account_id: account.id,
      amount,
      fee,
      net_amount: netAmount,
      bank_name: account.bank_name,
      account_number: account.account_number,
      account_holder: account.account_holder,
      status: "requested",
      note: note ?? null,
      requested_by: ownerId,
    })
    .select()
    .single();

  if (error || !withdrawal) {
    return { error: error?.message ?? "Gagal membuat pengajuan" };
  }

  const hold = await holdBalance(supabase, {
    companyId,
    amount,
    referenceType: "withdrawal",
    referenceId: withdrawal.id,
    note: `Hold pengajuan pencairan ${withdrawal.id}`,
    createdBy: ownerId,
  });

  if (!hold.ok) {
    await supabase
      .from("withdrawals")
      .update({ status: "failed", reject_reason: hold.error ?? "Gagal hold saldo" })
      .eq("id", withdrawal.id);

    return { error: hold.error ?? "Gagal mengunci saldo" };
  }

  try {
    await sendBillingEmail(supabase, {
      companyId,
      type: "withdrawal_requested",
      period: withdrawal.id,
      subject: "Pengajuan pencairan diterima",
      eyebrow: "Pencairan Saldo",
      title: "Pengajuan pencairan diterima.",
      paragraphs: [
        `Pengajuan pencairan ${formatRupiah(amount)} ke ${account.bank_name} ${account.account_number} (${account.account_holder}) sudah kami terima.`,
        "Tim Rakku akan memproses transfer maksimal 1×24 jam kerja.",
      ],
      note: "Saldo Anda sudah dikunci sampai pencairan selesai atau ditolak.",
    });
  } catch (err) {
    console.error("[withdrawals] gagal kirim email:", err);
  }

  return { withdrawal: withdrawal as Withdrawal };
}
