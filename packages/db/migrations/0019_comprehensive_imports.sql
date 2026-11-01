-- Additive import v2. Apply after 0018 using the existing migration/runtime grant policy.
ALTER TABLE app_private.import_batches DROP CONSTRAINT import_batches_domain_check;
ALTER TABLE app_private.import_batches ADD CONSTRAINT import_batches_domain_check
  CHECK (domain IN ('products','employees','ingredients','purchases'));
ALTER TABLE app_private.import_batches
  ADD COLUMN schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version IN (1,2)),
  ADD COLUMN context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN created_by_owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL,
  ADD COLUMN confirmed_by_owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL,
  ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  ADD COLUMN confirmation_options jsonb,
  ADD COLUMN confirmation_result jsonb,
  ADD COLUMN image_lease_token uuid,
  ADD COLUMN image_lease_until timestamptz,
  ADD CONSTRAINT import_batches_asset_scope_uq UNIQUE (id,company_id);
ALTER TABLE app_private.import_rows ADD COLUMN warnings jsonb NOT NULL DEFAULT '[]'::jsonb;

-- The complete normalized purchase payload is hashed independently of file/batch identity.
-- Retain the ledger even if a purchase or batch is removed: re-upload must never restock it.
CREATE TABLE app_private.import_purchase_references (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  reference text NOT NULL CHECK (reference ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  purchase_id uuid REFERENCES public.ingredient_purchases(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES app_private.import_batches(id) ON DELETE SET NULL,
  created_by_owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id,outlet_id,reference)
);
CREATE INDEX import_purchase_references_batch_idx ON app_private.import_purchase_references(batch_id);

-- Processed, stripped WebP only, bounded by the API to 12 MiB/batch (2 MiB/asset).
-- Private durable bytes let a failed confirmation retry without the original ZIP.
CREATE TABLE app_private.import_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  company_id uuid NOT NULL,
  outlet_id uuid NOT NULL,
  reference text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  processed_base64 text CHECK (length(processed_base64) <= 2796204),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 2097152),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 800),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 800),
  state text NOT NULL DEFAULT 'staged' CHECK (state IN ('staged','uploaded','attached','cleanup_pending','deleted')),
  provider_file_id text,
  provider_url text,
  cleanup_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id,reference),
  -- Retain the original outlet UUID for cleanup even when batch.outlet_id is SET NULL
  -- by outlet deletion. Confirmation always rechecks all three scope values.
  FOREIGN KEY (batch_id,company_id) REFERENCES app_private.import_batches(id,company_id) ON DELETE CASCADE,
  CHECK ((provider_file_id IS NULL) = (provider_url IS NULL))
);
CREATE INDEX import_assets_cleanup_idx ON app_private.import_assets(company_id,state,batch_id);
CREATE INDEX import_batches_expiry_idx ON app_private.import_batches(company_id,expires_at) WHERE status='validated';

REVOKE ALL ON app_private.import_assets,app_private.import_purchase_references FROM PUBLIC;
ALTER TABLE app_private.import_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.import_assets FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.import_assets FOR ALL
  USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));
ALTER TABLE app_private.import_purchase_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.import_purchase_references FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.import_purchase_references FOR ALL
  USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));

-- Match the existing runtime's table grants (no hard-coded role name and no PUBLIC grants).
DO $$ DECLARE target text; grant_row record; BEGIN
  FOR target IN SELECT unnest(ARRAY['import_assets','import_purchase_references']) LOOP
    FOR grant_row IN SELECT grantee,privilege_type FROM information_schema.role_table_grants
      WHERE table_schema='app_private' AND table_name='import_batches' AND grantee<>'PUBLIC'
        AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE') LOOP
      EXECUTE format('GRANT %s ON app_private.%I TO %I',grant_row.privilege_type,target,grant_row.grantee);
    END LOOP;
  END LOOP;
END $$;
