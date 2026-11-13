-- Signup campaign window and each owner's benefit period are deliberately separate.
CREATE TABLE app_private.signup_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  duration_months integer NOT NULL CHECK (duration_months BETWEEN 1 AND 24),
  starts_on date NOT NULL, ends_on date NOT NULL,
  terms text NOT NULL DEFAULT '' CHECK (length(terms) <= 5000),
  is_active boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_on >= DATE '2000-01-01' AND ends_on <= DATE '2100-12-31' AND ends_on >= starts_on),
  -- One unambiguous automatic signup offer per date, including concurrent writes.
  EXCLUDE USING gist (daterange(starts_on,ends_on,'[]') WITH &&) WHERE (is_active)
);
CREATE INDEX signup_promotions_plan_idx ON app_private.signup_promotions(plan_id);

-- Every newly registered owner receives a decision, including "no offer". No
-- backfill: old owners/onboarding retries can never acquire a later campaign.
CREATE TABLE app_private.signup_promotion_enrollments (
  owner_id uuid PRIMARY KEY REFERENCES public.owners(id) ON DELETE CASCADE,
  promotion_id uuid REFERENCES app_private.signup_promotions(id) ON DELETE RESTRICT,
  plan_id uuid REFERENCES public.plans(id) ON DELETE RESTRICT,
  promotion_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  benefit_starts_at timestamptz, benefit_ends_at timestamptz,
  company_id uuid UNIQUE REFERENCES public.companies(id) ON DELETE SET NULL,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((promotion_id IS NULL AND plan_id IS NULL AND benefit_starts_at IS NULL AND benefit_ends_at IS NULL)
    OR (promotion_id IS NOT NULL AND plan_id IS NOT NULL AND benefit_starts_at IS NOT NULL
      AND benefit_ends_at IS NOT NULL AND benefit_ends_at > benefit_starts_at))
);
CREATE INDEX signup_promotion_enrollments_promotion_idx ON app_private.signup_promotion_enrollments(promotion_id,created_at DESC);
CREATE INDEX signup_promotion_enrollments_plan_idx ON app_private.signup_promotion_enrollments(plan_id);

CREATE TABLE app_private.signup_promotions_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES app_private.signup_promotions(id) ON DELETE RESTRICT,
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 200),
  before_config jsonb, after_config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signup_promotions_audit_promotion_idx ON app_private.signup_promotions_audit(promotion_id,created_at DESC);

-- A campaign edit must never rewrite an already awarded owner's entitlement.
CREATE FUNCTION app_private.protect_signup_benefit() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,app_private AS $$
BEGIN
  IF ROW(NEW.owner_id,NEW.promotion_id,NEW.plan_id,NEW.promotion_snapshot,NEW.benefit_starts_at,NEW.benefit_ends_at,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.owner_id,OLD.promotion_id,OLD.plan_id,OLD.promotion_snapshot,OLD.benefit_starts_at,OLD.benefit_ends_at,OLD.created_at) THEN
    RAISE EXCEPTION 'Signup entitlement is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.applied_at IS NOT NULL AND NEW.applied_at IS DISTINCT FROM OLD.applied_at THEN
    RAISE EXCEPTION 'Signup entitlement was already applied' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.protect_signup_benefit() FROM PUBLIC;
CREATE TRIGGER protect_signup_benefit BEFORE UPDATE ON app_private.signup_promotion_enrollments
  FOR EACH ROW EXECUTE FUNCTION app_private.protect_signup_benefit();

REVOKE ALL ON app_private.signup_promotions,app_private.signup_promotion_enrollments,app_private.signup_promotions_audit FROM PUBLIC;
ALTER TABLE app_private.signup_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.signup_promotions FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.signup_promotions FOR ALL
  USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));
ALTER TABLE app_private.signup_promotion_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.signup_promotion_enrollments FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.signup_promotion_enrollments FOR ALL
  USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));
ALTER TABLE app_private.signup_promotions_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.signup_promotions_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_read ON app_private.signup_promotions_audit FOR SELECT USING ((SELECT app_private.platform()));
CREATE POLICY platform_append ON app_private.signup_promotions_audit FOR INSERT WITH CHECK ((SELECT app_private.platform()));

-- Existing deployments already have Pro. On a fresh installation neon-seed
-- invokes the same idempotent default after creating plans. Never change owners.
INSERT INTO app_private.signup_promotions(id,name,plan_id,duration_months,starts_on,ends_on,terms,is_active)
SELECT 'e26c0000-0000-4000-8000-000000000001','Promo Pengguna Baru 2026',id,3,
  (now() AT TIME ZONE 'Asia/Jakarta')::date,DATE '2026-12-31',
  'Untuk akun baru. Pro gratis 3 bulan kalender sejak pendaftaran akun. Daftar paling lambat 31 Desember 2026 pukul 23.59 WIB. Hak akses tetap berlaku sampai tanggal akhir masing-masing. Setelah berakhir, akun menggunakan paket Free kecuali telah berlangganan.',true
FROM public.plans WHERE slug='pro' AND is_active=true AND (now() AT TIME ZONE 'Asia/Jakarta')::date <= DATE '2026-12-31';

DO $$ DECLARE target text; grant_row record; BEGIN
  FOR target IN SELECT unnest(ARRAY['signup_promotions','signup_promotion_enrollments','signup_promotions_audit']) LOOP
    FOR grant_row IN SELECT DISTINCT grantee,privilege_type FROM information_schema.role_table_grants
      WHERE table_schema='app_private' AND table_name='auth_sessions' AND grantee<>'PUBLIC'
        AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE') LOOP
      IF target <> 'signup_promotions_audit' OR grant_row.privilege_type IN ('SELECT','INSERT') THEN
        EXECUTE format('GRANT %s ON app_private.%I TO %I',grant_row.privilege_type,target,grant_row.grantee);
      END IF;
    END LOOP;
  END LOOP;
END $$;
