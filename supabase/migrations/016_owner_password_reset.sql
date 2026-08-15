-- ============================================================
-- Rakku POS — Migration 016: Owner Password Reset
-- ============================================================
-- Menambahkan kolom untuk fitur "Lupa Sandi" owner.
-- Token disimpan sebagai hash sha256 (bukan plain) untuk keamanan;
-- token plain hanya dikirim via email dan tidak pernah masuk DB.
-- Expiry 1 jam; setelah dipakai atau kadaluarsa, kolom di-clear.

ALTER TABLE owners
  ADD COLUMN reset_token_hash      text,
  ADD COLUMN reset_token_expires_at timestamptz;

-- Lookup by token hash saat user submit form reset
CREATE INDEX idx_owners_reset_token_hash
  ON owners(reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;

COMMENT ON COLUMN owners.reset_token_hash       IS 'Hash sha256 dari token reset yang dikirim via email. Token plain tidak pernah disimpan.';
COMMENT ON COLUMN owners.reset_token_expires_at IS 'Waktu kadaluarsa token reset (default 1 jam setelah generate).';
