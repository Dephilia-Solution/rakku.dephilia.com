-- Apply after 0005 inside one transaction. The migration runner's transaction
-- already provides this; do not add BEGIN/COMMIT here. Snapshot BEFORE
-- normalization; install invalidation AFTER it so NULL -> false does not log
-- out cashiers.
LOCK TABLE public.roles, public.role_menu_access IN ACCESS EXCLUSIVE MODE;

CREATE TABLE app_private.role_grants_0009_snapshot (
  role_id uuid NOT NULL, company_id uuid NOT NULL, menu_id uuid NOT NULL,
  can_view boolean, can_create boolean, can_edit boolean, can_delete boolean,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, menu_id)
);
REVOKE ALL ON app_private.role_grants_0009_snapshot FROM PUBLIC;
ALTER TABLE app_private.role_grants_0009_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.role_grants_0009_snapshot FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_read ON app_private.role_grants_0009_snapshot FOR SELECT
  USING ((SELECT app_private.platform()));
CREATE POLICY platform_snapshot ON app_private.role_grants_0009_snapshot FOR INSERT
  WITH CHECK ((SELECT app_private.platform()));

-- Migrator may be subject to FORCE RLS as well. This setting is transaction-local.
SELECT set_config('app.scope', 'platform', true);
INSERT INTO app_private.role_grants_0009_snapshot
  (role_id, company_id, menu_id, can_view, can_create, can_edit, can_delete)
SELECT a.role_id, r.company_id, a.menu_id, a.can_view, a.can_create, a.can_edit, a.can_delete
FROM public.role_menu_access a JOIN public.roles r ON r.id = a.role_id;

UPDATE public.role_menu_access SET
  can_view = can_view IS TRUE, can_create = can_create IS TRUE,
  can_edit = can_edit IS TRUE, can_delete = can_delete IS TRUE
WHERE can_view IS NULL OR can_create IS NULL OR can_edit IS NULL OR can_delete IS NULL;
ALTER TABLE public.role_menu_access
  ALTER COLUMN can_view SET DEFAULT false, ALTER COLUMN can_view SET NOT NULL,
  ALTER COLUMN can_create SET DEFAULT false, ALTER COLUMN can_create SET NOT NULL,
  ALTER COLUMN can_edit SET DEFAULT false, ALTER COLUMN can_edit SET NOT NULL,
  ALTER COLUMN can_delete SET DEFAULT false, ALTER COLUMN can_delete SET NOT NULL;
-- Deliberately NO view=>CRUD backfill, role-name inference, or constraint that
-- would erase/reject existing explicit CRUD flags with can_view=false.
ALTER TABLE public.roles ADD COLUMN grants_revision bigint NOT NULL DEFAULT 0
  CHECK (grants_revision >= 0);

CREATE TABLE app_private.role_grants_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL,
  role_id uuid NOT NULL, actor_kind text NOT NULL CHECK (actor_kind IN ('owner','superadmin')),
  actor_id text NOT NULL, before_grants jsonb NOT NULL, after_grants jsonb NOT NULL,
  before_revision text NOT NULL, after_revision text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX role_grants_audit_role_idx ON app_private.role_grants_audit(company_id, role_id, created_at);
REVOKE ALL ON app_private.role_grants_audit FROM PUBLIC;
ALTER TABLE app_private.role_grants_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.role_grants_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_read ON app_private.role_grants_audit FOR SELECT
  USING ((SELECT app_private.platform()));
CREATE POLICY platform_append ON app_private.role_grants_audit FOR INSERT
  WITH CHECK ((SELECT app_private.platform()));

-- Invoker trigger: existing platform runtime must have UPDATE auth_sessions and
-- roles privileges. No security-definer bypass or public callable admin RPC.
CREATE FUNCTION app_private.invalidate_role_grants() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, app_private AS $$
DECLARE affected uuid[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD IS NOT DISTINCT FROM NEW THEN RETURN NULL; END IF;
    affected := ARRAY[OLD.role_id, NEW.role_id];
  ELSIF TG_OP = 'DELETE' THEN affected := ARRAY[OLD.role_id];
  ELSE affected := ARRAY[NEW.role_id];
  END IF;
  -- Stable order when a raw UPDATE moves a grant between roles.
  PERFORM id FROM public.roles WHERE id = ANY(affected) ORDER BY id FOR UPDATE;
  UPDATE public.roles SET grants_revision = grants_revision + 1 WHERE id = ANY(affected);
  UPDATE app_private.auth_sessions s SET revoked_at = now()
  WHERE s.kind = 'pos' AND s.revoked_at IS NULL
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = s.subject_id AND u.role_id = ANY(affected));
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION app_private.invalidate_role_grants() FROM PUBLIC;
CREATE TRIGGER invalidate_role_grants AFTER INSERT OR UPDATE OR DELETE ON public.role_menu_access
  FOR EACH ROW EXECUTE FUNCTION app_private.invalidate_role_grants();
