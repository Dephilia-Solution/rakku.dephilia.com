import { createAdminClient as createPlatformClient } from "@rakku/db";
import type { TenantSession } from "@rakku/shared-types";
import {
  allowsApiPolicy,
  hasMenuCapability,
  resolveApiPolicy,
  type AccessCapability,
  type MenuGrant,
} from "@rakku/auth-utils/access-policy";

export class AccessDeniedError extends Error {
  readonly status = 403;
  readonly code = "FORBIDDEN";
  constructor(message = "Akses ditolak") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export interface CapabilityRequirement {
  menu: string;
  capability: AccessCapability;
}

export async function loadSessionGrants(roleId: string): Promise<MenuGrant[]> {
  const result = await createPlatformClient()
    .from("role_menu_access")
    .select("can_view, can_create, can_edit, can_delete, menus!inner(slug)")
    .eq("role_id", roleId);
  if (result.error) throw new Error("Pemeriksaan akses gagal");
  return (result.data ?? []).flatMap(row => {
    const menu = (row as unknown as { menus?: { slug?: unknown } }).menus;
    if (!menu || typeof menu.slug !== "string") return [];
    return [{
      menu: menu.slug,
      can_view: row.can_view === true,
      can_create: row.can_create === true,
      can_edit: row.can_edit === true,
      can_delete: row.can_delete === true,
    }];
  });
}

export async function assertApiAccess(session: TenantSession, path: string, method: string): Promise<void> {
  const policy = resolveApiPolicy(path, method);
  if (!policy) throw new AccessDeniedError("Endpoint tidak diizinkan");
  if (policy.kind === "authenticated") return;
  const grants = await loadSessionGrants(session.role_id);
  if (!allowsApiPolicy(policy, grants)) throw new AccessDeniedError();
}

export async function requireSessionCapability(
  session: TenantSession,
  menu: string,
  capability: AccessCapability,
): Promise<void> {
  const grants = await loadSessionGrants(session.role_id);
  if (!hasMenuCapability(grants, menu, capability)) throw new AccessDeniedError();
}

export async function requireAnySessionCapability(
  session: TenantSession,
  requirements: CapabilityRequirement[],
): Promise<void> {
  const grants = await loadSessionGrants(session.role_id);
  if (!requirements.some(requirement => hasMenuCapability(grants, requirement.menu, requirement.capability))) {
    throw new AccessDeniedError();
  }
}
