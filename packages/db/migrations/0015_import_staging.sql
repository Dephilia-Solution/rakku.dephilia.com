-- Additive staging untuk fitur Import Excel (Produk & Karyawan).
-- Server-side only (owner API membuat batch/rows sebagai platform scope),
-- runtime app tidak membaca tabel ini langsung. Run after 0014.
CREATE TABLE app_private.import_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  domain        text NOT NULL CHECK (domain IN ('products', 'employees')),
  outlet_id     uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  file_name     text NOT NULL,
  total_rows    integer NOT NULL DEFAULT 0,
  valid_rows    integer NOT NULL DEFAULT 0,
  error_rows    integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'validated'
                CHECK (status IN ('validated', 'confirmed', 'failed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at  timestamptz
);

CREATE TABLE app_private.import_rows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    uuid NOT NULL REFERENCES app_private.import_batches(id) ON DELETE CASCADE,
  row_number  integer NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_valid    boolean NOT NULL DEFAULT true,
  errors      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, row_number)
);

REVOKE ALL ON app_private.import_batches, app_private.import_rows FROM PUBLIC;
ALTER TABLE app_private.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.import_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.import_batches
  FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));
ALTER TABLE app_private.import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.import_rows FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.import_rows
  FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));

CREATE INDEX IF NOT EXISTS import_batches_company_idx
  ON app_private.import_batches(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS import_rows_batch_idx
  ON app_private.import_rows(batch_id, row_number);
