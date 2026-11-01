-- Read-only opening balance / journal reconciliation review.
-- Run only on an authorized isolated target. This file does not mutate data.
BEGIN TRANSACTION READ ONLY;

-- Current buckets per company. No names, bank accounts, emails or credentials.
SELECT company_id, available_balance, pending_balance, unsettled_balance,
  (available_balance + pending_balance + unsettled_balance) AS liability,
  total_credited, total_fees, total_withdrawn, updated_at
FROM public.merchant_balances
ORDER BY company_id;

-- Journal-derived view. Available should equal the sum of available deltas;
-- unsettled should equal the sum of unsettled deltas.
SELECT company_id,
  sum(amount) FILTER (WHERE type = 'sale_credit') AS sale_credit_net,
  sum(fee_amount) FILTER (WHERE type = 'sale_credit') AS mdr,
  sum(unsettled_delta) AS unsettled_delta_total,
  sum(amount) FILTER (WHERE type = 'settlement_credit') AS settlement_credit,
  sum(amount) FILTER (WHERE type = 'withdrawal_hold') AS withdrawal_hold,
  sum(amount) FILTER (WHERE type = 'withdrawal_refund') AS withdrawal_refund,
  sum(amount) FILTER (WHERE type = 'withdrawal') AS withdrawal_amount,
  sum(amount) FILTER (WHERE type = 'adjustment') AS adjustment,
  sum(amount) FILTER (WHERE type = 'refund') AS refund,
  count(*) AS journal_rows
FROM public.balance_transactions
GROUP BY company_id
ORDER BY company_id;

-- Receipts not yet settled, and receipts allocated more than once.
SELECT company_id, count(*) AS unsettled_receipts
FROM public.balance_transactions
WHERE type = 'sale_credit' AND settlement_report_id IS NULL AND settled_at IS NULL
GROUP BY company_id ORDER BY company_id;

SELECT settlement_report_id, company_id, count(*) AS receipt_rows,
  sum(amount) AS receipt_net
FROM public.balance_transactions
WHERE type = 'sale_credit' AND settlement_report_id IS NOT NULL
GROUP BY settlement_report_id, company_id
HAVING count(*) > 0
ORDER BY settlement_report_id, company_id;

-- Settlement reports awaiting review and provider references.
SELECT id, provider, provider_reference, period_start, period_end,
  gross_amount, mdr_amount, net_amount, expected_net, difference, status,
  settled_at, created_at
FROM public.settlement_reports
WHERE status IN ('recorded','discrepancy','reconciled')
ORDER BY period_end DESC, created_at DESC;

-- Withdrawals and holds that need operator review. IDs and amounts only.
SELECT w.id, w.company_id, w.amount, w.fee, w.net_amount, w.status,
  w.request_id, w.requested_at, w.processed_at,
  (SELECT count(*) FROM public.balance_transactions b
    WHERE b.company_id = w.company_id AND b.reference_type = 'withdrawal'
      AND b.reference_id = w.id) AS ledger_rows
FROM public.withdrawals w
WHERE w.status IN ('requested','processing','failed')
   OR NOT EXISTS (SELECT 1 FROM public.balance_transactions b
     WHERE b.company_id = w.company_id AND b.reference_type = 'withdrawal'
       AND b.reference_id = w.id AND b.type = 'withdrawal_hold')
ORDER BY w.requested_at;

COMMIT;
