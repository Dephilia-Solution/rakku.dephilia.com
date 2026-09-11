import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BalanceTransaction,
  BalanceTransactionType,
  MerchantBalance,
} from "@rakku/shared-types";

export const QRIS_MDR_RATE = 0.007;

export const EMPTY_BALANCE: Omit<MerchantBalance, "company_id"> = {
  available_balance: 0,
  pending_balance: 0,
  total_credited: 0,
  total_fees: 0,
  total_withdrawn: 0,
  updated_at: "",
};

export interface BalanceMutationInput {
  companyId: string;
  type: BalanceTransactionType;
  amount: number;
  pendingDelta?: number;
  feeAmount?: number;
  outletId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}

export interface BalanceMutationResult {
  ok: boolean;
  txId?: string;
  available?: number;
  inserted?: boolean;
  error?: string;
}

interface RpcRow {
  tx_id: string;
  new_available: number | string;
  inserted: boolean;
}

/**
 * Mutasi saldo atomic + idempotent (RPC `apply_balance_transaction`).
 * Satu (reference_type, reference_id, type) hanya tercatat sekali.
 */
export async function applyBalanceTransaction(
  supabase: SupabaseClient,
  input: BalanceMutationInput
): Promise<BalanceMutationResult> {
  const { data, error } = await supabase.rpc("apply_balance_transaction", {
    p_company_id: input.companyId,
    p_outlet_id: input.outletId ?? null,
    p_type: input.type,
    p_amount: input.amount,
    p_pending_delta: input.pendingDelta ?? 0,
    p_fee_amount: input.feeAmount ?? 0,
    p_reference_type: input.referenceType ?? null,
    p_reference_id: input.referenceId ?? null,
    p_note: input.note ?? null,
    p_created_by: input.createdBy ?? "system",
  });

  if (error) {
    const insufficient = error.message.includes("INSUFFICIENT_BALANCE");
    return {
      ok: false,
      error: insufficient ? "Saldo tidak mencukupi" : error.message,
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as RpcRow | null;
  if (!row) return { ok: false, error: "Gagal mencatat mutasi saldo" };

  return {
    ok: true,
    txId: row.tx_id,
    available: Number(row.new_available),
    inserted: Boolean(row.inserted),
  };
}

/** Kredit saldo dari pembayaran QRIS: net = gross − MDR 0,7%. */
export async function creditBalance(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    outletId?: string | null;
    grossAmount: number;
    referenceType: string;
    referenceId: string;
    note?: string | null;
    createdBy?: string | null;
  }
): Promise<BalanceMutationResult> {
  const fee = Math.round(input.grossAmount * QRIS_MDR_RATE);
  const net = input.grossAmount - fee;

  return applyBalanceTransaction(supabase, {
    companyId: input.companyId,
    outletId: input.outletId,
    type: "sale_credit",
    amount: net,
    pendingDelta: 0,
    feeAmount: fee,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    note: input.note ?? `Pembayaran QRIS (MDR ${fee})`,
    createdBy: input.createdBy ?? "system",
  });
}

/** Hold saldo untuk pengajuan withdrawal: available → pending. */
export async function holdBalance(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    amount: number;
    referenceType: string;
    referenceId: string;
    note?: string | null;
    createdBy?: string | null;
  }
): Promise<BalanceMutationResult> {
  return applyBalanceTransaction(supabase, {
    companyId: input.companyId,
    type: "withdrawal_hold",
    amount: -input.amount,
    pendingDelta: input.amount,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    note: input.note ?? "Hold pengajuan pencairan",
    createdBy: input.createdBy ?? "system",
  });
}

/** Kembalikan saldo saat withdrawal ditolak: pending → available. */
export async function releaseBalance(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    amount: number;
    referenceType: string;
    referenceId: string;
    note?: string | null;
    createdBy?: string | null;
  }
): Promise<BalanceMutationResult> {
  return applyBalanceTransaction(supabase, {
    companyId: input.companyId,
    type: "withdrawal_refund",
    amount: input.amount,
    pendingDelta: -input.amount,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    note: input.note ?? "Pengajuan pencairan ditolak",
    createdBy: input.createdBy ?? "system",
  });
}

/** Selesaikan withdrawal: pending keluar, total_withdrawn naik. */
export async function settleWithdrawal(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    amount: number;
    fee?: number;
    referenceType: string;
    referenceId: string;
    note?: string | null;
    createdBy?: string | null;
  }
): Promise<BalanceMutationResult> {
  return applyBalanceTransaction(supabase, {
    companyId: input.companyId,
    type: "withdrawal",
    amount: 0,
    pendingDelta: -input.amount,
    feeAmount: input.fee ?? 0,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    note: input.note ?? "Pencairan selesai",
    createdBy: input.createdBy ?? "system",
  });
}

/** Koreksi manual superadmin (wajib note). */
export async function adjustBalance(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    amount: number;
    note: string;
    createdBy?: string | null;
  }
): Promise<BalanceMutationResult> {
  return applyBalanceTransaction(supabase, {
    companyId: input.companyId,
    type: "adjustment",
    amount: input.amount,
    note: input.note,
    referenceType: "manual",
    referenceId: null,
    createdBy: input.createdBy ?? "superadmin",
  });
}

export async function getBalance(
  supabase: SupabaseClient,
  companyId: string
): Promise<MerchantBalance> {
  const { data } = await supabase
    .from("merchant_balances")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!data) return { company_id: companyId, ...EMPTY_BALANCE };

  return {
    company_id: data.company_id as string,
    available_balance: Number(data.available_balance),
    pending_balance: Number(data.pending_balance),
    total_credited: Number(data.total_credited),
    total_fees: Number(data.total_fees),
    total_withdrawn: Number(data.total_withdrawn),
    updated_at: (data.updated_at as string) ?? "",
  };
}

export async function listBalanceTransactions(
  supabase: SupabaseClient,
  companyId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<BalanceTransaction[]> {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  const { data } = await supabase
    .from("balance_transactions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return (data ?? []) as BalanceTransaction[];
}
