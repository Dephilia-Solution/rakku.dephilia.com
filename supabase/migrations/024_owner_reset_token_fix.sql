-- ============================================================
-- Rakku POS — Migration 024: Owner Reset Token Fix
-- ============================================================
-- Migration 016 tercatat "applied" di riwayat migrasi remote,
-- tetapi DDL-nya tidak pernah benar-benar dieksekusi (kolom
-- reset_token_hash & reset_token_expires_at tidak ada di tabel
-- owners). Akibatnya fitur "Lupa Sandi" owner selalu gagal
-- menyimpan token dan email reset tidak pernah terkirim.
--
-- Migration ini mengulang DDL 016 secara idempotent agar aman
-- dijalankan pada environment mana pun (yang kolomnya sudah ada
-- maupun yang belum).
-- ============================================================

ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS reset_token_hash      text,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz;

-- Lookup by token hash saat user submit form reset
CREATE INDEX IF NOT EXISTS idx_owners_reset_token_hash
  ON owners(reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;

COMMENT ON COLUMN owners.reset_token_hash       IS 'Hash sha256 dari token reset yang dikirim via email. Token plain tidak pernah disimpan.';
COMMENT ON COLUMN owners.reset_token_expires_at IS 'Waktu kadaluarsa token reset (default 1 jam setelah generate).';
