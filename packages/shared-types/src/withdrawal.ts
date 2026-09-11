export type WithdrawalStatus =
  | "requested"
  | "processing"
  | "completed"
  | "rejected"
  | "failed";

export interface MerchantBankAccount {
  id: string;
  company_id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  is_default: boolean;
  status: string;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  company_id: string;
  bank_account_id: string | null;
  amount: number;
  fee: number;
  net_amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: WithdrawalStatus;
  note: string | null;
  reject_reason: string | null;
  transfer_proof_url: string | null;
  reference_number: string | null;
  requested_by: string | null;
  processed_by: string | null;
  requested_at: string;
  processed_at: string | null;
  updated_at: string;
}
