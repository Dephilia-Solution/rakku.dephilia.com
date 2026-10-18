import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/db";
import { getRoleGrants, saveRoleGrants, RoleAccessError } from "@rakku/db/roles-access";
import { checkFeature } from "@rakku/plans";

type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  return error instanceof RoleAccessError
    ? NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    : NextResponse.json({ error: "Gagal memproses akses role" }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: Context) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return NextResponse.json({ error: "Anda belum memiliki perusahaan" }, { status: 403 });
  try {
    const { id } = await params;
    const result = await getRoleGrants(createAdminClient(), session.company_id, id);
    return NextResponse.json({ ...result, menu_access: result.grants.filter(g => g.can_view).map(g => g.menu_id) });
  } catch (error) { return failure(error); }
}

// Full replacement, never a menu-only toggle. Missing/legacy payloads fail
// validation before writes; expectedRevision prevents stale overwrites.
export async function POST(request: NextRequest, { params }: Context) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return NextResponse.json({ error: "Anda belum memiliki perusahaan" }, { status: 403 });
  try {
    const { id } = await params;
    const db = createAdminClient();
    await getRoleGrants(db, session.company_id, id);
    const feature = await checkFeature(db, session.company_id, "custom_roles");
    if (!feature.allowed) return NextResponse.json(feature, { status: 403 });
    const body = await request.json().catch(() => null);
    if (!body || Object.keys(body).some(key => !["grants", "expectedRevision"].includes(key))) {
      return NextResponse.json({ error: "Kirim { grants, expectedRevision }; toggle menu lama tidak didukung" }, { status: 400 });
    }
    const result = await saveRoleGrants(db, { companyId: session.company_id, roleId: id,
      grants: body.grants, expectedRevision: body.expectedRevision, actor: { kind: "owner", id: session.owner_id } });
    return NextResponse.json(result);
  } catch (error) { return failure(error); }
}
