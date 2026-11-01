-- A menu now grants either full access (view/create/edit/delete) or no access.
-- Preserve prior visibility: any menu previously viewable becomes fully enabled.
LOCK TABLE public.roles, public.role_menu_access IN ACCESS EXCLUSIVE MODE;

CREATE TABLE app_private.role_grants_0018_snapshot (
  role_id uuid NOT NULL,
  company_id uuid NOT NULL,
  menu_id uuid NOT NULL,
  can_view boolean NOT NULL,
  can_create boolean NOT NULL,
  can_edit boolean NOT NULL,
  can_delete boolean NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, menu_id)
);
REVOKE ALL ON app_private.role_grants_0018_snapshot FROM PUBLIC;
ALTER TABLE app_private.role_grants_0018_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.role_grants_0018_snapshot FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_read ON app_private.role_grants_0018_snapshot FOR SELECT
  USING ((SELECT app_private.platform()));
CREATE POLICY platform_snapshot ON app_private.role_grants_0018_snapshot FOR INSERT
  WITH CHECK ((SELECT app_private.platform()));

SELECT set_config('app.scope', 'platform', true);
INSERT INTO app_private.role_grants_0018_snapshot
  (role_id, company_id, menu_id, can_view, can_create, can_edit, can_delete)
SELECT a.role_id, r.company_id, a.menu_id, a.can_view, a.can_create, a.can_edit, a.can_delete
FROM public.role_menu_access a
JOIN public.roles r ON r.id = a.role_id;

UPDATE public.role_menu_access
SET can_create = (can_view IS TRUE),
    can_edit = (can_view IS TRUE),
    can_delete = (can_view IS TRUE)
WHERE can_create IS DISTINCT FROM (can_view IS TRUE)
   OR can_edit IS DISTINCT FROM (can_view IS TRUE)
   OR can_delete IS DISTINCT FROM (can_view IS TRUE);

ALTER TABLE public.role_menu_access
  ADD CONSTRAINT role_menu_access_all_or_none
  CHECK (can_view = can_create AND can_view = can_edit AND can_view = can_delete);
