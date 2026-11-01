-- Run only through the separately authorized target review process. This file
-- does NOT grant access, infer roles by name, or mutate flags. No names, emails,
-- usernames, credentials, session IDs, or row-level grant values in its output.
BEGIN TRANSACTION READ ONLY;

SELECT count(*) AS grant_rows,
  count(*) FILTER (WHERE can_view IS TRUE) AS view_rows,
  count(*) FILTER (WHERE can_view IS TRUE AND can_create IS NOT TRUE
    AND can_edit IS NOT TRUE AND can_delete IS NOT TRUE) AS view_only_rows,
  count(*) FILTER (WHERE can_view IS NULL OR can_create IS NULL
    OR can_edit IS NULL OR can_delete IS NULL) AS rows_with_null,
  count(*) FILTER (WHERE can_view IS NOT TRUE
    AND (can_create IS TRUE OR can_edit IS TRUE OR can_delete IS TRUE)) AS mutation_rows_without_view
FROM public.role_menu_access;

-- Current strict-true capabilities, and legacy can_view-only exposure that
-- explicit enforcement will stop. These are counts, never an automatic map.
SELECT m.slug AS menu,
  count(a.role_id) AS grant_rows,
  count(*) FILTER (WHERE a.can_view IS TRUE) AS explicit_view,
  count(*) FILTER (WHERE a.can_view IS TRUE AND a.can_create IS TRUE) AS explicit_create,
  count(*) FILTER (WHERE a.can_view IS TRUE AND a.can_edit IS TRUE) AS explicit_edit,
  count(*) FILTER (WHERE a.can_view IS TRUE AND a.can_delete IS TRUE) AS explicit_delete,
  count(*) FILTER (WHERE a.can_view IS TRUE AND a.can_create IS NOT TRUE) AS create_not_granted,
  count(*) FILTER (WHERE a.can_view IS TRUE AND a.can_edit IS NOT TRUE) AS edit_not_granted,
  count(*) FILTER (WHERE a.can_view IS TRUE AND a.can_delete IS NOT TRUE) AS delete_not_granted,
  count(*) FILTER (WHERE a.role_id IS NOT NULL AND a.can_view IS NOT TRUE
    AND (a.can_create IS TRUE OR a.can_edit IS TRUE OR a.can_delete IS TRUE)) AS hidden_mutation_rows,
  count(*) FILTER (WHERE a.role_id IS NOT NULL AND (a.can_view IS NULL OR a.can_create IS NULL
    OR a.can_edit IS NULL OR a.can_delete IS NULL)) AS rows_to_normalize
FROM public.menus m LEFT JOIN public.role_menu_access a ON a.menu_id=m.id
GROUP BY m.slug ORDER BY m.slug;

-- Review queue keyed ONLY by company/role ID, including roles with zero grants.
-- Resolve merchant intent through an authorized reviewer outside this report.
SELECT r.company_id, r.id AS role_id, count(a.menu_id) AS grant_rows,
  count(*) FILTER (WHERE a.can_view IS TRUE) AS view_rows,
  count(*) FILTER (WHERE a.can_view IS TRUE AND a.can_create IS TRUE) AS create_rows,
  count(*) FILTER (WHERE a.can_view IS TRUE AND a.can_edit IS TRUE) AS edit_rows,
  count(*) FILTER (WHERE a.can_view IS TRUE AND a.can_delete IS TRUE) AS delete_rows,
  count(*) FILTER (WHERE a.menu_id IS NOT NULL AND (a.can_view IS NULL OR a.can_create IS NULL
    OR a.can_edit IS NULL OR a.can_delete IS NULL)) AS rows_to_normalize,
  count(*) FILTER (WHERE a.menu_id IS NOT NULL AND a.can_view IS NOT TRUE
    AND (a.can_create IS TRUE OR a.can_edit IS TRUE OR a.can_delete IS TRUE)) AS needs_explicit_review
FROM public.roles r LEFT JOIN public.role_menu_access a ON a.role_id=r.id
GROUP BY r.company_id,r.id ORDER BY r.company_id,r.id;
COMMIT;
