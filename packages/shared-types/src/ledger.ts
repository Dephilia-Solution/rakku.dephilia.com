export type BalanceTransactionType =
  | "sale_credit"
  | "withdrawal_hold"
  | "withdrawal"
  | "withdrawal_refund"
  | "withdrawal_fee"
  | "adjustment"
  | "refund";

export interface MerchantBalance {
  company_id: string;
  available_balance: number;
  pending_balance: number;
  total_credited: number;
  total_fees: number;
  total_withdrawn: number;
  updated_at: string;
}

export interface BalanceTransaction {
  id: string;
  company_id: string;
  outlet_id: string | null;
  type: BalanceTransactionType;
  amount: number;
  pending_delta: number;
  fee_amount: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}
