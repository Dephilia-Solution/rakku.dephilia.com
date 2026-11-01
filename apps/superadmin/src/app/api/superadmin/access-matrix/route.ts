import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/auth/database";
import { getRoleGrants, saveRoleGrants, RoleAccessError } from "@rakku/db/roles-access";

function failure(error: unknown) {
  if (error instanceof RoleAccessError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  return NextResponse.json({ error: "Gagal memproses akses role" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  // createClient verifies origin, current managed session AND active membership.
  let db;
  try { db = await createClient(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const companyId = request.nextUrl.searchParams.get("company_id");
    if (!companyId || !/^[0-9a-f-]{36}$/i.test(companyId)) return NextResponse.json({ error: "company_id required" }, { status: 400 });
    const rolesResult = await db.from("roles").select("id, name").eq("company_id", companyId).order("name");
    const menusResult = await db.from("menus").select("id,slug,name,icon,path,sort_order").order("sort_order");
    if (rolesResult.error || menusResult.error) throw new Error("Query failed");
    // Never read the unfiltered grant table: each role read is company-scoped.
    const roles = await Promise.all((rolesResult.data ?? []).map(async role => {
      const result = await getRoleGrants(db, companyId, role.id);
      return { id: role.id, name: role.name, ...result, menu_access: result.grants.filter(g => g.can_view).map(g => g.menu_id) };
    }));
    return NextResponse.json({ roles, menus: menusResult.data ?? [],
      access: roles.flatMap(role => role.grants.map(grant => ({ role_id: role.id, ...grant }))) });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  let db;
  try { db = await createClient(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const body = await request.json().catch(() => null);
    if (!body || Object.keys(body).some(key => !["company_id", "role_id", "grants", "expectedRevision"].includes(key))) {
      return NextResponse.json({ error: "Kirim company_id, role_id, grants lengkap dan expectedRevision; toggle menu lama tidak didukung" }, { status: 400 });
    }
    const { data: { user } } = await db.auth.getUser();
    const result = await saveRoleGrants(db, { companyId: body.company_id, roleId: body.role_id,
      grants: body.grants, expectedRevision: body.expectedRevision, actor: { kind: "superadmin", id: user.id } });
    return NextResponse.json(result);
  } catch (error) { return failure(error); }
}
