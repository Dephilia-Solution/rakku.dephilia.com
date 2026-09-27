-- ============================================================
-- Rakku POS — Migration 027: Notification Logs (v6.0 M4)
-- ============================================================
-- Mencegah email notifikasi billing terkirim berulang.
-- UNIQUE (company_id, type, period) = satu notifikasi per periode.
-- Idempotent: aman dijalankan ulang.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS notification_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type       text NOT NULL,
  period     text NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, type, period)
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_company
  ON notification_logs(company_id);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_notification_logs" ON notification_logs;
CREATE POLICY "allow_authenticated_notification_logs"
  ON notification_logs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE notification_logs IS 'Log email notifikasi billing (idempotency per company/type/period).';

COMMIT;
