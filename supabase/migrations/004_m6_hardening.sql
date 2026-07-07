-- ============================================================
-- Stocko POS — Migration 004: M6 Polish & Hardening
-- ============================================================
-- Features:
-- 1. Company login rate limiting
-- 2. Comprehensive audit logging
-- 3. Session idle timeout support

-- ============================================================
-- 1. Company Login Rate Limiting Columns
-- ============================================================

-- Add rate limiting columns to companies table
-- Following the same pattern as PIN lockout in users table
ALTER TABLE companies
  ADD COLUMN failed_login_attempts int DEFAULT 0,
  ADD COLUMN login_locked_until timestamptz,
  ADD COLUMN last_login_attempt timestamptz;

-- ============================================================
-- 2. Audit Logs Table
-- ============================================================

-- Create comprehensive audit log table for all authentication events
CREATE TABLE auth_audit_logs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid,
  outlet_id        uuid,
  user_id          uuid,
  event_type       text not null, -- 'company_login', 'outlet_select', 'account_select', 'pin_verify', 'session_created', 'logout'
  success          boolean not null,
  ip_address       text,
  user_agent       text,
  failure_reason   text,         -- e.g., "wrong_password", "account_locked", "pin_expired", "company_not_found"
  metadata         jsonb,       -- Additional context: {attempt_number, remaining_attempts, locked_until, etc.}
  created_at       timestamptz default now()
);

-- Indexes for efficient queries
CREATE INDEX idx_audit_logs_company ON auth_audit_logs(company_id);
CREATE INDEX idx_audit_logs_outlet ON auth_audit_logs(outlet_id);
CREATE INDEX idx_audit_logs_user ON auth_audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX idx_audit_logs_success ON auth_audit_logs(success);
CREATE INDEX idx_audit_logs_created_at ON auth_audit_logs(created_at DESC);

-- Composite index for common queries (filtering by company and date)
CREATE INDEX idx_audit_logs_company_created ON auth_audit_logs(company_id, created_at DESC);

-- ============================================================
-- 3. Enable RLS for Audit Logs
-- ============================================================

ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated_audit_logs"
  ON auth_audit_logs FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 4. Comments for Documentation
-- ============================================================

COMMENT ON COLUMN companies.failed_login_attempts IS 'Tracks failed company login attempts for rate limiting (max 10)';
COMMENT ON COLUMN companies.login_locked_until IS 'Timestamp until which company login is locked after too many failed attempts';
COMMENT ON COLUMN companies.last_login_attempt IS 'Timestamp of the last login attempt (successful or failed)';

COMMENT ON TABLE auth_audit_logs IS 'Comprehensive audit log for all authentication events. Tracks login attempts, session creation, and logout events.';
COMMENT ON COLUMN auth_audit_logs.event_type IS 'Type of event: company_login, outlet_select, account_select, pin_verify, session_created, logout';
COMMENT ON COLUMN auth_audit_logs.failure_reason IS 'Reason for failure: wrong_password, account_locked, company_not_found, wrong_pin, etc.';
COMMENT ON COLUMN auth_audit_logs.metadata IS 'Additional context as JSON: attempt number, remaining attempts, lock duration, etc.';
