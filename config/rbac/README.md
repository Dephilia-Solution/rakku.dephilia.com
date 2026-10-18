# Phase 2 — grant contract, review and recovery

Local source only. No active DB, environment, provider or deployment was used.
This document covers data/migration, Owner/Superadmin, POS enforcement and demo
integration. Do not treat PGlite as a proof of two-connection PostgreSQL
concurrency or a merchant browser acceptance result.

## Fixed legacy policy

- Each flag is allowed only when it is literally `true`. NULL becomes false.
- V does **not** imply C/E/D. Runtime mutation requires V **and** the requested
  explicit capability. No role name (including Owner/Kasir) backfills old roles.
- Migration 0009 snapshots **every** existing flag row, including NULLs, false V
  and all-false rows, before normalization. Explicit CRUD with V=false remains
  stored and returned. It is not silently cleared or activated.
- New writes require all four flags as booleans; C/E/D require V. An unchanged
  inconsistent legacy row must be deliberately resolved before a full save:
  enable V or explicitly remove its mutation flags. Editors show the condition
  and never repair it automatically.

## Exact integration contract (including demo)

Types are exported from `@rakku/db/roles-access` (type-only imports in clients).
The package currently lists subpaths explicitly; `./roles-access` is included.

Owner:

- `GET /api/owner/roles` → `{ roles: [{ id, name, menu_access, grants, revision }], menus }`.
- `GET /api/owner/roles/:id/access` → `{ menu_access, grants, revision }`.
- `POST /api/owner/roles/:id/access` body **exactly** `{ grants, expectedRevision }`.
- Successful POST → `{ grants, revision }`, the committed canonical state.
- New roles start empty. Role POST accepts `{ name }`; PATCH accepts a name or
  legacy `{ action: "delete" }`, with no grant fields. Both deletion paths use
  the same transactional helper. Existing Owner origin/session/ownership guards
  and `custom_roles` feature gates apply to mutations, including rename/delete.

Superadmin:

- `GET /api/superadmin/access-matrix?company_id=<UUID>` → the same roles/menus
  collection plus compatibility `access: [{ role_id, ...grant }]`. All grants
  are scoped to that selected company's role IDs, including the access array.
- POST body `{ company_id, role_id, grants, expectedRevision }` → `{ grants, revision }`.
  The role must belong to company_id. Active Managed Auth membership and origin
  validation are retained. The actor is derived server-side, never from JSON.

Each grant is exactly:

```json
{
  "menu_id": "11111111-1111-4111-8111-111111111111",
  "can_view": true,
  "can_create": false,
  "can_edit": true,
  "can_delete": false
}
```

`grants` is a **full replacement** array; omission deletes a row, `[]` clears
the role. Include unchanged rows, especially explicit all-false/legacy rows;
never reconstruct from menu_access. `menu_access` is read compatibility only,
containing menu IDs whose V is true. Revisions are opaque strings from GET/POST,
not numbers or timestamps. Triggers may advance them more than once per batch.

Validation/legacy menu-only writes → 400. Role/company mismatch → 404. Duplicate
menu IDs (case-insensitive), unknown menu IDs, null/string/number/missing flags,
missing revision, and mutations without V are rejected before writes. Stale
revision → 409 with `code: "STALE_REVISION"`; never auto-retry with a new revision.
Reload, review and reapply deliberately. Failed network response can represent a
committed save; reload to reconcile before retry. Editors retain drafts on error
and have one in-flight save; no optimistic per-checkbox network requests.

## POS enforcement and demo parity

The POS registry lives in `packages/auth-utils/src/access-policy.ts`. It maps
method + anchored path to explicit V/C/E/D alternatives. Unknown paths and
methods return no policy and deny. `HEAD` follows `GET`; the QRIS status GET is
treated as an edit action because it currently finalizes payments. `/api/admin/
subscription` is the only explicit authenticated-bootstrap GET; auth and public
menu routes never enter this registry.

`apps/pos/src/lib/db.ts` evaluates the policy before returning a tenant client,
so the check runs before the first tenant query and before provider upload/email
calls. It also denies action grants whose `can_view` is false and denies admin/
report API requests when proxy route metadata is missing. The proxy continues to
overwrite client-supplied route metadata. Body-dependent branches add checks in
the route: draft completion requires `register.can_create`, QRIS draft conversion
requires `register`/`orders` edit, and table rename requires `tables.can_edit`
(occupancy alone may use `register.can_edit`). The dashboard layout also rejects
a direct page segment that is not a permitted `can_view` menu. Denial is a
thrown 403 error; handlers that propagate error status return 403, while older
handlers without a catch may surface a generic 500. No mutation side effect runs
before denial.

The demo reuses the production Owner editor. Fixture roles now carry explicit
grants: Manager has all CRUD; Kasir has register CRUD, orders view/edit/delete,
and reports/tax-discounts view-only. Demo role access GET/POST uses the same
`{ grants, revision }` full-replacement contract and rejects stale revisions.
The demo POS dispatcher still models menu visibility rather than every server
capability; it is a UI/contract simulation, not production authorization evidence.

## New onboarding only

The onboarding transaction uses IDs just created for Owner and Kasir, with a
shared explicit slug map. No existing role is inferred from a matching name.

| Role | Slugs | V/C/E/D |
|---|---|---|
| Owner | register, orders, reports, products, tax-discounts, ingredients, purchases, expenses, tables, taxes, discounts | true/true/true/true |
| Kasir | register | true/true/true/true |
| Kasir | orders | true/false/true/true |
| Kasir | reports, tax-discounts | true/false/false/false |

`taxes`/`discounts` are supported legacy POS aliases. Unknown/future slugs are not
automatically granted; review the map together with POS supported endpoint policy.

## Read-only impact and per-role review

1. Have the authorized DB operator run `impact-read-only.sql` in the reviewed,
   isolated target using a role that can see all relevant companies. It runs in
   `READ ONLY`; it does not set scope or bypass RLS. If necessary the operator
   sets trusted platform scope on their own transaction/connection. Confirm that
   RLS has not made a partial count look like a full inventory.
2. Retain aggregate menu/count results and the ID-only review queue. The report
   emits no names, usernames, emails, credentials, sessions or per-row flag values.
3. For **each company_id + role_id**, assign an authorized reviewer and record
   intended per-menu V/C/E/D, affected workflows, decision and review timestamp.
   Review zero-grant roles and hidden mutation rows too. Never derive intent from
   a role name or mechanically convert view-only roles into operators.
4. Apply migration separately from any deliberate new grants. It changes only
   null semantics/defaults and installs integrity/revocation machinery.
5. Read the role via the API, review its full grant set and revision, then submit
   a separate deliberate POST. Keep returned revision and private audit ID in
   the operational change record. Re-fetch and exercise view-only/operator
   workflows under the independently implemented POS policy.

## Rollout, privileges and ordering

1. Resolve environment isolation and take a tested target backup/restore point.
   Run the read-only report and review IDs first. None of this was run live here.
2. Pause grant editing during the migration/release boundary; clients using old
   menu-only payloads must receive 400, not a destructive compatibility rewrite.
3. Apply 0005 before **0009_role_grants.sql**. The migration runner wraps files
   in one transaction; 0009 deliberately has no `BEGIN`/`COMMIT`. If applying it
   manually, wrap the file in a transaction. It locks roles/grants, sets
   transaction-local platform scope, snapshots all rows, normalizes nulls and
   adds NOT NULL/default false, then installs revocation. Normalization does not
   revoke existing POS sessions. No CRUD is newly granted.
4. Review target runtime ACLs. Private schema/table privileges are never granted
   to PUBLIC. Snapshot needs migrator INSERT and authorized operator SELECT only.
   Runtime needs SELECT/INSERT on role_grants_audit, and existing UPDATE on
   auth_sessions plus role/grant DML for invoker triggers. Give these to the
   actual trusted server runtime role through environment provisioning, not a
   guessed role name. No SECURITY DEFINER or public administrative RPC is added.
   Both private tables have ENABLE + FORCE RLS and platform-only policies;
   snapshot/audit have no UPDATE/DELETE policy. Existing trusted app.scope model
   still assumes database credentials are never distributed to clients.
5. Deploy coordinated API/editor/POS/demo changes. Smoke-test fresh and old
   clients, tenant filtering, conflict recovery and immediate session rejection.
   An actual changed grant row (including row insertion/removal) revokes all
   unrevoked POS sessions for role users **inside the grant transaction**.
   Identical saves, identical raw UPDATEs and role rename do not revoke. Raw
   INSERT/UPDATE/DELETE triggers also advance revisions and revoke sessions.
   Role assignment changes retain the 0005 revocation behavior.
6. Validate with two real disposable PostgreSQL connections: overlapping saves,
   raw DML versus API saves, menu deletion, role deletion versus assignment,
   and PIN login/session issuance versus a grant change. PostgreSQL can reject
   deadlocks or deferred-FK races; the entire command must roll back. No claim of
   cross-connection acceptance is made by the PGlite tests.

## Snapshot verification and rollback runbook

Retain `app_private.role_grants_0009_snapshot` permanently through rollback. It
has no cascading FK, so role/menu deletion cannot delete the recovery evidence.
The audit retains before/after JSON, revisions and actor identity for API saves,
also without cascading FKs. Raw grant writes invalidate but do not create a
batch API audit record; use database operational audit for those changes.

Before any restore: pause editing, select the **explicit reviewed role ID
allowlist**, take a new current snapshot/backup, and compare schema/app versions.
Do not restore all merchants or resurrect deleted roles/menus automatically.
Count missing IDs and stop to review them. Pre-0009 snapshots do not describe
roles created later. Restoring NULLs requires a coordinated schema downgrade.

### Recommended capability rollback (retain new schema/enforcement)

1. For each reviewed role ID still in its original company, an authorized DB
   operator reads its original snapshot and maps each flag with `IS TRUE`.
   This preserves **exact** strict-true semantics; no view=>CRUD expansion.
2. If all restored rows satisfy the new write contract, use GET + deliberate
   full-replacement API POST with current revision. This audits/revokes atomically.
3. If the original includes explicit C/E/D with V=false, the API intentionally
   rejects it. Use a separately reviewed operator transaction to restore that
   role's snapshot rows with `IS TRUE` (never clear those flags to make an API
   request pass). Lock role `FOR UPDATE`, verify company, capture current rows,
   delete/insert **only that role's rows**, and record the before/after evidence
   in the change record. Leave triggers enabled. Revision/session invalidation
   participates in the same commit; on any failure ROLLBACK everything.
4. Validate grant counts and runtime capability behavior; do not clear revoked_at
   or reduce grants_revision. Users log in afresh. Keep the audit/snapshot tables.

### Exact original NULL restoration (only with coordinated application rollback)

This is an operator-reviewed maintenance operation, not an automatic down
migration. Keep the 0009 snapshot, audit and revisions. In one transaction:

```sql
BEGIN;
SELECT set_config('app.scope','platform',true);
LOCK TABLE public.roles, public.role_menu_access IN ACCESS EXCLUSIVE MODE;
-- Populate a temporary allowlist with reviewed company_id/role_id pairs.
-- Verify every allowlisted role/menu still exists and companies match snapshot.
-- Capture current rows separately BEFORE deleting any allowlisted grants.
ALTER TABLE public.role_menu_access
  ALTER COLUMN can_view DROP NOT NULL, ALTER COLUMN can_view SET DEFAULT true,
  ALTER COLUMN can_create DROP NOT NULL, ALTER COLUMN can_edit DROP NOT NULL,
  ALTER COLUMN can_delete DROP NOT NULL;
-- DELETE allowlisted role rows, then INSERT the matching snapshot columns
-- verbatim, including NULL. Do not coalesce in an exact historical restore.
-- Check restored counts and IS NOT DISTINCT FROM equality for all four flags.
-- Keep grant triggers ENABLED: restore revokes sessions in this transaction.
COMMIT;
```

The commented restore steps deliberately require a concrete reviewed ID list;
this is not executable blanket restore automation. If verification fails, roll
back before commit. Do not drop 0009 objects or restore revoked sessions. New
APIs map historical NULLs to false, but subsequent writes will normalize saved
rows; exact NULL preservation requires keeping editing paused until the
coordinated schema/app decision is complete. Returning to an old view-only POS
enforcer reintroduces overbroad mutation access and needs a separate release
decision; data rollback alone cannot make it safe.

## Local verification

`packages/db/src/roles-access.test.ts` uses PGlite memory, applies 0001–0008,
loads all 16 boolean combinations plus NULL fixtures, then applies 0009. Tests
cover snapshot fidelity, normalization/no escalation, NOT NULL defaults,
ownership/validation/conflict, canonical replacement/no-op, before/after audit,
same-transaction revocation, late audit rollback, raw DML/no-op/move rollback,
rename versus assignment, atomic delete failures, onboarding defaults, and
private RLS/PUBLIC revocation. It never creates an active database client.

`packages/auth-utils/src/access-policy.test.ts` covers every merchant route and
method in the registry, view-only/creator/editor/deleter/no-grant cases,
view-less legacy grants, register-only cashier access, tax/discount aliases,
QRIS mutation-shaped reads, report email V+C, unknown paths/methods, and HEAD.
`pnpm test:demo` covers the Owner role contract and demo projections. Endpoint
coverage and current results are repeated in `PHASE_2_REPORT.md`.
