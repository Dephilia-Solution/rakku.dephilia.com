import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./query";

export interface RoleGrant {
  menu_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}
export interface RoleGrants { grants: RoleGrant[]; revision: string; }
export interface GrantActor { kind: "owner" | "superadmin"; id: string; }
export class RoleAccessError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = "RoleAccessError";
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validId(id: unknown): id is string { return typeof id === "string" && uuid.test(id); }
function validateScope(companyId: string, roleId: string) {
  if (!validId(companyId) || !validId(roleId)) throw new RoleAccessError("INVALID_ID", "ID perusahaan/role tidak valid", 400);
}

// A single statement snapshot keeps grants and revision consistent, including
// raw DB writes. Persisted grants are all-on or all-off for the entire menu.
export async function getRoleGrants(db: DatabaseClient, companyId: string, roleId: string): Promise<RoleGrants> {
  validateScope(companyId, roleId);
  const [row] = await db.execute(sql`select r.grants_revision::text as revision,
    coalesce((select jsonb_agg(jsonb_build_object('menu_id',a.menu_id,
      'can_view',a.can_view IS TRUE,'can_create',a.can_create IS TRUE,
      'can_edit',a.can_edit IS TRUE,'can_delete',a.can_delete IS TRUE) order by a.menu_id)
      from public.role_menu_access a where a.role_id=r.id), '[]'::jsonb) as grants
    from public.roles r where r.id=${roleId} and r.company_id=${companyId}`);
  if (!row) throw new RoleAccessError("ROLE_NOT_FOUND", "Role tidak ditemukan", 404);
  return { grants: row.grants as RoleGrant[], revision: String(row.revision) };
}

function validateGrants(value: unknown): RoleGrant[] {
  if (!Array.isArray(value)) throw new RoleAccessError("INVALID_GRANTS", "Kirim grants lengkap dan expectedRevision; toggle menu lama tidak didukung", 400);
  const seen = new Set<string>();
  const flags = ["can_view", "can_create", "can_edit", "can_delete"] as const;
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new RoleAccessError("INVALID_GRANTS", "Grant tidak valid", 400);
    const g = entry as Record<string, unknown>;
    if (!validId(g.menu_id) || flags.some(flag => typeof g[flag] !== "boolean")
      || Object.keys(g).some(key => key !== "menu_id" && !flags.includes(key as typeof flags[number]))) {
      throw new RoleAccessError("INVALID_GRANTS", "Setiap grant wajib memiliki menu_id dan boolean izin yang valid", 400);
    }
    const menu_id = g.menu_id.toLowerCase();
    if (seen.has(menu_id)) throw new RoleAccessError("DUPLICATE_MENU", "Menu duplikat", 400);
    seen.add(menu_id);
    if (flags.some(flag => g[flag] !== g.can_view)) {
      throw new RoleAccessError("ALL_OR_NONE_REQUIRED", "Akses setiap menu harus penuh atau nonaktif; semua izin harus bernilai sama", 400);
    }
    return { menu_id, can_view: g.can_view as boolean, can_create: g.can_create as boolean,
      can_edit: g.can_edit as boolean, can_delete: g.can_delete as boolean };
  }).sort((a, b) => a.menu_id.localeCompare(b.menu_id));
}

export async function saveRoleGrants(db: DatabaseClient, input: {
  companyId: string; roleId: string; grants: unknown; expectedRevision: unknown; actor: GrantActor;
}): Promise<RoleGrants> {
  validateScope(input.companyId, input.roleId);
  const grants = validateGrants(input.grants);
  if (typeof input.expectedRevision !== "string" || !/^(0|[1-9][0-9]{0,18})$/.test(input.expectedRevision)) {
    throw new RoleAccessError("REVISION_REQUIRED", "expectedRevision wajib diisi dari GET terbaru", 400);
  }
  if (!input.actor || !["owner", "superadmin"].includes(input.actor.kind)
    || typeof input.actor.id !== "string" || !input.actor.id.trim() || input.actor.id.length > 200) {
    throw new RoleAccessError("INVALID_ACTOR", "Actor tidak valid", 400);
  }
  return db.transaction(async tx => {
    const locked = await tx.execute(sql`select id from public.roles
      where id=${input.roleId} and company_id=${input.companyId} for update`);
    if (!locked.length) throw new RoleAccessError("ROLE_NOT_FOUND", "Role tidak ditemukan", 404);
    const before = await getRoleGrants(tx, input.companyId, input.roleId);
    if (before.revision !== input.expectedRevision) {
      throw new RoleAccessError("STALE_REVISION", "Akses telah berubah. Muat ulang lalu tinjau perubahan sebelum menyimpan", 409);
    }
    // Lock menu keys against concurrent deletion; unknown IDs never clear flags.
    if (grants.length) {
      const ids = sql.join(grants.map(g => sql`${g.menu_id}::uuid`), sql`, `);
      const menus = await tx.execute(sql`select id from public.menus where id in (${ids}) order by id for key share`);
      if (menus.length !== grants.length) throw new RoleAccessError("UNKNOWN_MENU", "Menu tidak terdaftar", 400);
    }
    // Compare flags rather than JSON property order (jsonb keys have DB ordering).
    const same = (a: RoleGrant, b: RoleGrant) => a.menu_id === b.menu_id && a.can_view === b.can_view
      && a.can_create === b.can_create && a.can_edit === b.can_edit && a.can_delete === b.can_delete;
    if (before.grants.length === grants.length && before.grants.every((g, i) => same(g, grants[i]))) return before;
    const payload = JSON.stringify(grants);
    await tx.execute(sql`delete from public.role_menu_access a where a.role_id=${input.roleId}
      and not exists (select 1 from jsonb_to_recordset(${payload}::jsonb) as g(menu_id uuid) where g.menu_id=a.menu_id)`);
    if (grants.length) {
      await tx.execute(sql`insert into public.role_menu_access (role_id,menu_id,can_view,can_create,can_edit,can_delete)
        select ${input.roleId}::uuid,menu_id,can_view,can_create,can_edit,can_delete
        from jsonb_to_recordset(${payload}::jsonb) as g(menu_id uuid,can_view boolean,can_create boolean,can_edit boolean,can_delete boolean)
        on conflict (role_id,menu_id) do update set can_view=excluded.can_view,can_create=excluded.can_create,
          can_edit=excluded.can_edit,can_delete=excluded.can_delete
        where (role_menu_access.can_view,role_menu_access.can_create,role_menu_access.can_edit,role_menu_access.can_delete)
          is distinct from (excluded.can_view,excluded.can_create,excluded.can_edit,excluded.can_delete)`);
    }
    // Triggers increment the revision and revoke role users' POS sessions in this
    // same transaction (also covering raw INSERT/UPDATE/DELETE). Audit failure
    // rolls back grants, revision AND revocation.
    const after = await getRoleGrants(tx, input.companyId, input.roleId);
    await tx.execute(sql`insert into app_private.role_grants_audit
      (company_id,role_id,actor_kind,actor_id,before_grants,after_grants,before_revision,after_revision)
      values (${input.companyId},${input.roleId},${input.actor.kind},${input.actor.id},
        ${JSON.stringify(before.grants)}::jsonb,${JSON.stringify(after.grants)}::jsonb,${before.revision},${after.revision})`);
    return after;
  });
}

export async function deleteRole(db: DatabaseClient, companyId: string, roleId: string): Promise<void> {
  validateScope(companyId, roleId);
  await db.transaction(async tx => {
    const role = await tx.execute(sql`select id from public.roles where id=${roleId} and company_id=${companyId} for update`);
    if (!role.length) throw new RoleAccessError("ROLE_NOT_FOUND", "Role tidak ditemukan", 404);
    const users = await tx.execute(sql`select id from public.users where role_id=${roleId} limit 1`);
    if (users.length) throw new RoleAccessError("ROLE_IN_USE", "Role masih dipakai karyawan", 409);
    await tx.execute(sql`delete from public.role_menu_access where role_id=${roleId}`);
    const deleted = await tx.execute(sql`delete from public.roles where id=${roleId} and company_id=${companyId} returning id`);
    if (deleted.length !== 1) throw new RoleAccessError("ROLE_NOT_FOUND", "Role tidak ditemukan", 404);
    // Deferred FK checks also prevent a concurrent assignment from committing
    // against a deleted role; any such failure rolls back its grants as well.
  });
}

// ONLY for new onboarding, never infer privileges for existing roles by name.
const full = { can_view: true, can_create: true, can_edit: true, can_delete: true };
export const ONBOARDING_GRANTS = {
  owner: { register: full, orders: full, reports: full, products: full, "tax-discounts": full,
    ingredients: full, purchases: full, expenses: full, tables: full, taxes: full, discounts: full },
  kasir: { register: full, orders: full, reports: full, "tax-discounts": full },
} as const;
export function onboardingRoleGrants(kind: keyof typeof ONBOARDING_GRANTS, menus: { id: string; slug: string }[]): RoleGrant[] {
  const policy: Record<string, Omit<RoleGrant, "menu_id">> = ONBOARDING_GRANTS[kind];
  return menus.flatMap(menu => Object.hasOwn(policy, menu.slug) ? [{ menu_id: menu.id, ...policy[menu.slug] }] : []);
}
