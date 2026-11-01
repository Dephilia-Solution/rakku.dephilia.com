-- Deploy before the application release. Legacy JWTs intentionally require login again.
CREATE TABLE app_private.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('owner', 'pos', 'pending', 'verify_email')),
  subject_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX auth_sessions_subject_idx ON app_private.auth_sessions(kind, subject_id);
CREATE INDEX auth_sessions_expiry_idx ON app_private.auth_sessions(expires_at);
REVOKE ALL ON app_private.auth_sessions FROM PUBLIC;
ALTER TABLE app_private.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.auth_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.auth_sessions FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));

CREATE TABLE app_private.auth_rate_limits (
  key_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL
);
REVOKE ALL ON app_private.auth_rate_limits FROM PUBLIC;
ALTER TABLE app_private.auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.auth_rate_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.auth_rate_limits FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));

-- Re-enabling an account must not resurrect an old browser token.
CREATE FUNCTION app_private.revoke_identity_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='owners' THEN
    IF OLD.password_hash IS DISTINCT FROM NEW.password_hash OR OLD.email IS DISTINCT FROM NEW.email
      OR OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      UPDATE app_private.auth_sessions SET revoked_at=now() WHERE kind='owner' AND subject_id=OLD.id AND revoked_at IS NULL;
    END IF;
  ELSIF TG_TABLE_NAME='users' THEN
    IF OLD.pin_hash IS DISTINCT FROM NEW.pin_hash OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.role_id IS DISTINCT FROM NEW.role_id OR OLD.company_id IS DISTINCT FROM NEW.company_id
      OR OLD.all_outlets IS DISTINCT FROM NEW.all_outlets THEN
      UPDATE app_private.auth_sessions SET revoked_at=now() WHERE kind='pos' AND subject_id=OLD.id AND revoked_at IS NULL;
    END IF;
  ELSIF TG_TABLE_NAME='companies' THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND OLD.owner_id IS NOT NULL THEN
      UPDATE app_private.auth_sessions SET revoked_at=now() WHERE kind='owner' AND subject_id=OLD.owner_id AND revoked_at IS NULL;
    END IF;
    IF OLD.password_hash IS DISTINCT FROM NEW.password_hash OR OLD.status IS DISTINCT FROM NEW.status THEN
      UPDATE app_private.auth_sessions SET revoked_at=now() WHERE revoked_at IS NULL AND
        ((kind='pending' AND subject_id=OLD.id) OR (kind='pos' AND subject_id IN (SELECT id FROM public.users WHERE company_id=OLD.id)));
    END IF;
  ELSIF TG_TABLE_NAME='outlets' THEN
    IF OLD.status IS DISTINCT FROM NEW.status OR OLD.company_id IS DISTINCT FROM NEW.company_id THEN
      UPDATE app_private.auth_sessions SET revoked_at=now() WHERE revoked_at IS NULL AND
        ((kind='pending' AND subject_id=OLD.company_id) OR (kind='pos' AND subject_id IN (SELECT id FROM public.users WHERE company_id=OLD.company_id)));
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER revoke_owner_sessions AFTER UPDATE ON public.owners FOR EACH ROW EXECUTE FUNCTION app_private.revoke_identity_sessions();
CREATE TRIGGER revoke_pos_sessions AFTER UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION app_private.revoke_identity_sessions();
CREATE TRIGGER revoke_company_sessions AFTER UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION app_private.revoke_identity_sessions();
CREATE TRIGGER revoke_outlet_sessions AFTER UPDATE ON public.outlets FOR EACH ROW EXECUTE FUNCTION app_private.revoke_identity_sessions();

CREATE FUNCTION app_private.revoke_assignment_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE affected uuid;
BEGIN
  IF TG_OP='DELETE' THEN affected:=OLD.user_id; ELSE affected:=NEW.user_id; END IF;
  UPDATE app_private.auth_sessions SET revoked_at=now() WHERE kind='pos' AND subject_id=affected AND revoked_at IS NULL;
  IF TG_OP='UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    UPDATE app_private.auth_sessions SET revoked_at=now() WHERE kind='pos' AND subject_id=OLD.user_id AND revoked_at IS NULL;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER revoke_assignment_sessions AFTER INSERT OR UPDATE OR DELETE ON public.user_outlets
  FOR EACH ROW EXECUTE FUNCTION app_private.revoke_assignment_sessions();
