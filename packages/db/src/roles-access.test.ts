import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import { issueSession, isSessionActive } from "./sessions";
import { getRoleGrants, saveRoleGrants, deleteRole, onboardingRoleGrants, RoleAccessError, type RoleGrant } from "./roles-access";

// Memory only. No env loading, network connection or application client creation.
const pg = new PGlite();
const dialect = new PgDialect();
let catalog: Catalog;
const executor = (connection: Pick<PGlite, "query">) => async (query: SQL): Promise<Row[]> => {
  const compiled = dialect.sqlToQuery(query);
  return (await connection.query<Row>(compiled.sql, compiled.params)).rows;
};
const execute = executor(pg);
const db = new DatabaseClient(execute, async () => catalog,
  work => pg.transaction(tx => work(new DatabaseClient(executor(tx), async () => catalog))));
let companyId: string;
let otherCompany: string;
let legacyRole: string;
let legacyUser: string;
let legacySession: string;
let originalRows: Row[];
let menus: { id: string; slug: string }[];
const actor = { kind: "owner" as const, id: randomUUID() };
const grant = (menu_id: string, flags: Partial<RoleGrant> = {}): RoleGrant =>
  ({ menu_id, can_view: true, can_create: true, can_edit: true, can_delete: true, ...flags });
async function role(name: string = randomUUID()) {
  const [row] = await execute(sql`insert into public.roles(company_id,name) values (${companyId},${name}) returning id`);
  return String(row.id);
}
async function user(roleId: string) {
  const [row] = await execute(sql`insert into public.users(company_id,role_id,name,username,pin_hash)
    values (${companyId},${roleId},'Fixture',${randomUUID()},'fixture-hash') returning id`);
  return String(row.id);
}
const current = (roleId: string) => getRoleGrants(db, companyId, roleId);
async function save(roleId: string, grants: RoleGrant[], revision?: string) {
  return saveRoleGrants(db, { companyId, roleId, grants, expectedRevision: revision ?? (await current(roleId)).revision, actor });
}
async function audits(roleId: string) {
  return execute(sql`select * from app_private.role_grants_audit where role_id=${roleId} order by created_at,id`);
}
function errorCode(code: string) { return (err: unknown) => err instanceof RoleAccessError && err.code === code; }

before(async () => {
  for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter(f => /^000[1-8]_.*\.sql$/.test(f)).sort()) {
    await pg.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  await execute(sql`select set_config('app.scope','platform',false)`);
  [companyId, otherCompany] = (await execute(sql`insert into public.companies(code,name,password_hash)
    values ('RBAC-A','Fixture A','fixture'),('RBAC-B','Fixture B','fixture') returning id`)).map(r => String(r.id));
  legacyRole = await role("Owner"); // Name must not cause a grant backfill.
  legacyUser = await user(legacyRole);
  catalog = await loadCatalog(execute);
  legacySession = await issueSession(db, "pos", legacyUser, 3600);
  const slugs = ["register", "orders", "reports", "products", "tax-discounts", "ingredients", "purchases", "expenses", "tables", "taxes", "discounts", "future-unmapped"];
  menus = [];
  for (const slug of slugs) {
    const [menu] = await execute(sql`insert into public.menus(slug,name,path) values (${slug},${slug},${`/${slug}`}) returning id,slug`);
    menus.push(menu as typeof menus[number]);
  }
  // Cover all 16 original boolean combinations plus all-null and mixed-null.
  for (let n = 0; n < 18; n++) {
    const [menu] = await execute(sql`insert into public.menus(slug,name,path) values (${`legacy-${n}`},'legacy','/legacy') returning id`);
    await execute(sql`insert into public.role_menu_access(role_id,menu_id,can_view,can_create,can_edit,can_delete)
      values (${legacyRole},${menu.id},${n < 16 ? !!(n & 1) : null},${n < 16 ? !!(n & 2) : n === 17 ? true : null},
        ${n < 16 ? !!(n & 4) : null},${n < 16 ? !!(n & 8) : n === 17 ? false : null})`);
  }
  originalRows = await execute(sql`select * from public.role_menu_access order by role_id,menu_id`);
  await pg.transaction(async tx => {
    await tx.exec(readFileSync(new URL("../migrations/0009_role_grants.sql", import.meta.url), "utf8"));
  });
  catalog = await loadCatalog(execute);
});
after(() => pg.close());

test("0009 snapshots legacy grants; 0018 maps visible menus to full access and enforces all-or-none", async () => {
  const snapshot = await execute(sql`select role_id,menu_id,can_view,can_create,can_edit,can_delete
    from app_private.role_grants_0009_snapshot order by role_id,menu_id`);
  assert.deepEqual(snapshot, originalRows);
  const normalized = await execute(sql`select * from public.role_menu_access order by role_id,menu_id`);
  assert.deepEqual(normalized, originalRows.map(row => ({ ...row, can_view: row.can_view === true,
    can_create: row.can_create === true, can_edit: row.can_edit === true, can_delete: row.can_delete === true })));
  assert.equal(await isSessionActive(db, legacySession, "pos", legacyUser), true);
  const result = await current(legacyRole);
  assert.equal(result.revision, "0");
  assert.equal(result.grants.length, 18);
  assert.ok(result.grants.some(g => !g.can_view && g.can_create));
  assert.equal((await audits(legacyRole)).length, 0);

  await pg.transaction(async tx => {
    await tx.exec(readFileSync(new URL("../migrations/0018_role_access_all_or_none.sql", import.meta.url), "utf8"));
  });
  const collapsed = await current(legacyRole);
  assert.ok(BigInt(collapsed.revision) > 0n);
  const expected: RoleGrant[] = originalRows.map(row => {
    const enabled = row.can_view === true;
    return { menu_id: String(row.menu_id), can_view: enabled, can_create: enabled, can_edit: enabled, can_delete: enabled };
  }).filter(grant => grant.menu_id);
  assert.deepEqual(collapsed.grants, expected.sort((a, b) => a.menu_id.localeCompare(b.menu_id)));
  const migrationSnapshot = await execute(sql`select role_id,company_id,menu_id,can_view,can_create,can_edit,can_delete
    from app_private.role_grants_0018_snapshot order by role_id,menu_id`);
  const snapshotExpected = originalRows.map(row => ({ role_id: row.role_id, company_id: companyId,
    menu_id: row.menu_id, can_view: row.can_view === true, can_create: row.can_create === true,
    can_edit: row.can_edit === true, can_delete: row.can_delete === true }));
  assert.deepEqual(migrationSnapshot, snapshotExpected);
  assert.equal(await isSessionActive(db, legacySession, "pos", legacyUser), false);
  await assert.rejects(() => execute(sql`update public.role_menu_access set can_create = not can_view
    where role_id=${legacyRole} and menu_id=${collapsed.grants[0].menu_id}`));
});

test("new DB flags default false and reject NULL without erasing legacy explicit grants", async () => {
  const id = await role();
  const [row] = await execute(sql`insert into public.role_menu_access(role_id,menu_id) values (${id},${menus[0].id}) returning *`);
  assert.deepEqual([row.can_view,row.can_create,row.can_edit,row.can_delete], [false,false,false,false]);
  await assert.rejects(() => execute(sql`update public.role_menu_access set can_create=null where role_id=${id}`));
  assert.equal((await current(id)).grants[0].can_create, false);
});

test("full replacement returns canonical grants/revision, audits before/after and revokes ONLY role POS users", async () => {
  const id = await role();
  const uid = await user(id);
  const uid2 = await user(id);
  const other = await user(await role());
  const sessions = await Promise.all([uid,uid2,other].map(subject => issueSession(db, "pos", subject, 3600)));
  const ownerSession = await issueSession(db, "owner", uid, 3600);
  const first = await save(id, [grant(menus[1].id), grant(menus[0].id)]);
  assert.deepEqual(first, await current(id));
  assert.ok(BigInt(first.revision) > 0n);
  assert.equal(await isSessionActive(db, sessions[0], "pos", uid), false);
  assert.equal(await isSessionActive(db, sessions[1], "pos", uid2), false);
  assert.equal(await isSessionActive(db, sessions[2], "pos", other), true);
  assert.equal(await isSessionActive(db, ownerSession, "owner", uid), true);
  const audit = await audits(id);
  assert.equal(audit.length, 1);
  assert.deepEqual(audit[0].before_grants, []);
  assert.deepEqual(audit[0].after_grants, first.grants);
  assert.equal(audit[0].before_revision, "0");
  assert.equal(audit[0].after_revision, first.revision);
  assert.equal(audit[0].actor_id, actor.id);
  const second = await save(id, [grant(menus[0].id)]);
  assert.deepEqual(second.grants, [grant(menus[0].id)]); // omitted menu removed; active menu always has full access
  const cleared = await save(id, []);
  assert.deepEqual(cleared.grants, []);
  assert.equal((await audits(id)).length, 3);
});

test("same grants in different order are a no-op: no revision, audit or session invalidation", async () => {
  const id = await role();
  const first = await save(id, [grant(menus[0].id), grant(menus[1].id)]);
  const uid = await user(id);
  const session = await issueSession(db, "pos", uid, 3600);
  const repeat = await save(id, [...first.grants].reverse(), first.revision);
  assert.deepEqual(repeat, first);
  assert.equal((await audits(id)).length, 1);
  assert.equal(await isSessionActive(db, session, "pos", uid), true);
});

test("stale revision rejects full replacement without clearing flags, auditing or revoking a fresh session", async () => {
  const id = await role();
  const first = await save(id, [grant(menus[0].id)]);
  const uid = await user(id);
  const session = await issueSession(db, "pos", uid, 3600);
  await assert.rejects(() => save(id, [], "0"), errorCode("STALE_REVISION"));
  assert.deepEqual(await current(id), first);
  assert.equal((await audits(id)).length, 1);
  assert.equal(await isSessionActive(db, session, "pos", uid), true);
});

test("ownership, unknown menus, duplicates, nonboolean/missing flags and partial grants fail closed", async () => {
  const id = await role();
  const first = await save(id, [grant(menus[0].id)]);
  const input = { companyId, roleId: id, grants: first.grants, expectedRevision: first.revision, actor };
  await assert.rejects(() => getRoleGrants(db, otherCompany, id), errorCode("ROLE_NOT_FOUND"));
  await assert.rejects(() => saveRoleGrants(db, { ...input, companyId: otherCompany }), errorCode("ROLE_NOT_FOUND"));
  await assert.rejects(() => save(id, [grant(randomUUID())]), errorCode("UNKNOWN_MENU"));
  await assert.rejects(() => save(id, [grant(menus[0].id),grant(menus[0].id.toUpperCase())]), errorCode("DUPLICATE_MENU"));
  for (const value of [null, "true", 1, undefined]) {
    await assert.rejects(() => saveRoleGrants(db, { ...input, grants: [{ ...first.grants[0], can_create: value }] }), errorCode("INVALID_GRANTS"));
  }
  await assert.rejects(() => saveRoleGrants(db, { ...input, grants: undefined }), errorCode("INVALID_GRANTS"));
  await assert.rejects(() => saveRoleGrants(db, { ...input, expectedRevision: undefined }), errorCode("REVISION_REQUIRED"));
  await assert.rejects(() => save(id, [grant(menus[0].id, { can_create: false })]), errorCode("ALL_OR_NONE_REQUIRED"));
  assert.deepEqual(await current(id), first);
  assert.equal((await audits(id)).length, 1);
});

test("late audit failure rolls back grant deletion/insertion, revision and session revocation together", async () => {
  const id = await role();
  const first = await save(id, [grant(menus[0].id)]);
  const uid = await user(id);
  const session = await issueSession(db, "pos", uid, 3600);
  await pg.exec(`CREATE FUNCTION app_private.reject_rbac_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.actor_id='reject-fixture' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_rbac_audit BEFORE INSERT ON app_private.role_grants_audit FOR EACH ROW EXECUTE FUNCTION app_private.reject_rbac_audit()`);
  await assert.rejects(() => saveRoleGrants(db, { companyId, roleId: id, grants: [grant(menus[1].id)], expectedRevision: first.revision,
    actor: { kind: "superadmin", id: "reject-fixture" } }), /injected audit failure/);
  assert.deepEqual(await current(id), first);
  assert.equal((await audits(id)).length, 1);
  assert.equal(await isSessionActive(db, session, "pos", uid), true);
  await save(id, [grant(menus[1].id)]);
  assert.equal(await isSessionActive(db, session, "pos", uid), false);
});

test("raw grant insert/update/delete invalidate in-transaction; raw no-op and role rename do not", async () => {
  const id = await role();
  const uid = await user(id);
  for (const action of ["insert", "update", "delete"]) {
    const session = await issueSession(db, "pos", uid, 3600);
    const before = await current(id);
    await db.transaction(async tx => {
      if (action === "insert") await tx.execute(sql`insert into public.role_menu_access(role_id,menu_id,can_view,can_create,can_edit,can_delete)
        values (${id},${menus[0].id},true,true,true,true)`);
      if (action === "update") await tx.execute(sql`update public.role_menu_access
        set can_view=false,can_create=false,can_edit=false,can_delete=false where role_id=${id}`);
      if (action === "delete") await tx.execute(sql`delete from public.role_menu_access where role_id=${id}`);
      assert.equal(await isSessionActive(tx, session, "pos", uid), false);
    });
    assert.notEqual((await current(id)).revision, before.revision);
  }
  await save(id, [grant(menus[0].id)]);
  const session = await issueSession(db, "pos", uid, 3600);
  const before = await current(id);
  await execute(sql`update public.role_menu_access set can_view=can_view where role_id=${id}`);
  await execute(sql`update public.roles set name='Renamed fixture' where id=${id}`);
  assert.deepEqual(await current(id), before);
  assert.equal(await isSessionActive(db, session, "pos", uid), true);
  const replacement = await role();
  await execute(sql`update public.users set role_id=${replacement} where id=${uid}`);
  assert.equal(await isSessionActive(db, session, "pos", uid), false);
});

test("raw grant move revokes users of both roles; an aborted raw mutation revokes neither", async () => {
  const id = await role(); const next = await role();
  await save(id, [grant(menus[0].id)]);
  const uid = await user(id); const uid2 = await user(next);
  const s1 = await issueSession(db, "pos", uid, 3600); const s2 = await issueSession(db, "pos", uid2, 3600);
  await assert.rejects(() => db.transaction(async tx => {
    await tx.execute(sql`update public.role_menu_access set role_id=${next} where role_id=${id}`);
    throw new Error("abort raw");
  }));
  assert.equal(await isSessionActive(db, s1, "pos", uid), true);
  assert.equal(await isSessionActive(db, s2, "pos", uid2), true);
  await execute(sql`update public.role_menu_access set role_id=${next} where role_id=${id}`);
  assert.equal(await isSessionActive(db, s1, "pos", uid), false);
  assert.equal(await isSessionActive(db, s2, "pos", uid2), false);
});

test("role delete checks ownership/in-use and rolls back grants when the final delete fails", async () => {
  const id = await role();
  const first = await save(id, [grant(menus[0].id)]);
  await user(id);
  await assert.rejects(() => deleteRole(db, otherCompany, id), errorCode("ROLE_NOT_FOUND"));
  await assert.rejects(() => deleteRole(db, companyId, id), errorCode("ROLE_IN_USE"));
  assert.deepEqual(await current(id), first);
  const unused = await role("delete-failure");
  const original = await save(unused, [grant(menus[0].id)]);
  await pg.exec(`CREATE FUNCTION app_private.reject_rbac_delete() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF OLD.name='delete-failure' THEN RAISE EXCEPTION 'injected role delete failure'; END IF; RETURN OLD; END $$;
    CREATE TRIGGER reject_rbac_delete BEFORE DELETE ON public.roles FOR EACH ROW EXECUTE FUNCTION app_private.reject_rbac_delete()`);
  await assert.rejects(() => deleteRole(db, companyId, unused), /injected role delete failure/);
  assert.deepEqual(await current(unused), original);
  await execute(sql`update public.roles set name='deletable' where id=${unused}`);
  await deleteRole(db, companyId, unused);
  await assert.rejects(() => current(unused), errorCode("ROLE_NOT_FOUND"));
  assert.equal((await execute(sql`select * from public.role_menu_access where role_id=${unused}`)).length, 0);
  assert.equal((await audits(unused)).length, 1); // audit survives role deletion
});

test("onboarding has explicit full-access per-menu Owner/Kasir defaults; unknown future menus stay ungranted", async () => {
  const owner = onboardingRoleGrants("owner", menus);
  assert.equal(owner.length, 11);
  assert.ok(owner.every(g => g.can_view && g.can_create && g.can_edit && g.can_delete));
  const kasir = onboardingRoleGrants("kasir", menus);
  assert.equal(kasir.length, 4);
  const bySlug = (slug: string) => kasir.find(g => g.menu_id === menus.find(m => m.slug === slug)?.id);
  assert.deepEqual(bySlug("register"), grant(menus[0].id));
  assert.deepEqual(bySlug("orders"), grant(menus[1].id));
  assert.deepEqual(bySlug("reports"), grant(menus[2].id));
  assert.deepEqual(bySlug("tax-discounts"), grant(menus[4].id));
  assert.equal(owner.some(g => g.menu_id === menus[11].id), false);
  assert.equal((await save(await role(), kasir)).grants.length, 4);
  assert.equal((await current(legacyRole)).grants.length, 18);
});

test("private snapshot/audit enforce RLS even with SELECT grants and same-company tenant context", async () => {
  await pg.exec(`CREATE ROLE rbac_tenant_test;
    GRANT USAGE ON SCHEMA app_private TO rbac_tenant_test;
    GRANT EXECUTE ON FUNCTION app_private.platform() TO rbac_tenant_test;
    GRANT SELECT ON app_private.role_grants_0009_snapshot,app_private.role_grants_0018_snapshot,app_private.role_grants_audit TO rbac_tenant_test`);
  await pg.transaction(async tx => {
    await tx.exec("SET LOCAL ROLE rbac_tenant_test");
      await executor(tx)(sql`select set_config('app.scope','tenant',true),set_config('app.company_id',${companyId},true)`);
      assert.deepEqual((await tx.query("select * from app_private.role_grants_0009_snapshot")).rows, []);
      assert.deepEqual((await tx.query("select * from app_private.role_grants_0018_snapshot")).rows, []);
      assert.deepEqual((await tx.query("select * from app_private.role_grants_audit")).rows, []);
  });
  const protection = await execute(sql`select relrowsecurity,relforcerowsecurity,
    not exists(select 1 from aclexplode(relacl) a where a.grantee=0) as public_revoked
    from pg_class where oid in ('app_private.role_grants_0009_snapshot'::regclass,'app_private.role_grants_0018_snapshot'::regclass,
      'app_private.role_grants_audit'::regclass)`);
  assert.equal(protection.length, 3);
  assert.ok(protection.every(r => r.relrowsecurity && r.relforcerowsecurity && r.public_revoked));
});
