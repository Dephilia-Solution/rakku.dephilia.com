-- Additive operational flags. Run after 0013.
CREATE TABLE app_private.runtime_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
REVOKE ALL ON app_private.runtime_flags FROM PUBLIC;
ALTER TABLE app_private.runtime_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.runtime_flags FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.runtime_flags
  FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));
INSERT INTO app_private.runtime_flags(key,enabled) VALUES ('checkout_paused',false)
ON CONFLICT (key) DO NOTHING;
