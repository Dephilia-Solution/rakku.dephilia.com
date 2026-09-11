-- ============================================================
-- Rakku POS — Migration 031: Settlement Reports (v6.1 M4)
-- ============================================================
-- Catatan rekonsiliasi: settlement Vessel/DOKU vs saldo sistem.
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS settlement_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text NOT NULL DEFAULT 'vessel',
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  gross_amount  numeric(14,2) NOT NULL DEFAULT 0,
  mdr_amount    numeric(14,2) NOT NULL DEFAULT 0,
  net_amount    numeric(14,2) NOT NULL DEFAULT 0,
  expected_net  numeric(14,2) NOT NULL DEFAULT 0,
  difference    numeric(14,2) NOT NULL DEFAULT 0,
  note          text,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlement_reports_period
  ON settlement_reports(period_end DESC);

ALTER TABLE settlement_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_settlement_reports" ON settlement_reports;
CREATE POLICY "allow_authenticated_settlement_reports"
  ON settlement_reports FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE settlement_reports IS 'Rekonsiliasi settlement Vessel/DOKU vs kredit saldo sistem (v6.1 M4).';

COMMIT;
