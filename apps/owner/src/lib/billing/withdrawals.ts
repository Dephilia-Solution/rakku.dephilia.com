export const MIN_WITHDRAWAL = 50_000;
export const WITHDRAWAL_FEE = 0;
export const WITHDRAWAL_DAILY_LIMIT = 10_000_000;
export const MAX_PENDING_WITHDRAWALS = 1;

export function formatRupiah(value: number): string {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}
