import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/db";
import { getRoleGrants, deleteRole, RoleAccessError } from "@rakku/db/roles-access";
import { checkFeature } from "@rakku/plans";
import { updateCompanyRole } from "@/lib/supabase/queries.owner";

type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  return error instanceof RoleAccessError
    ? NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    : NextResponse.json({ error: "Gagal memproses role" }, { status: 500 });
}
async function mutate(request: NextRequest, { params }: Context, remove: boolean) {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) return NextResponse.json({ error: "Anda belum memiliki perusahaan" }, { status: 403 });
  try {
    const { id } = await params;
    const db = createAdminClient();
    await getRoleGrants(db, session.company_id, id);
    const feature = await checkFeature(db, session.company_id, "custom_roles");
    if (!feature.allowed) return NextResponse.json(feature, { status: 403 });
    const body = remove ? null : await request.json().catch(() => null);
    if (!remove && (!body || Object.keys(body).some(key => !["name", "action"].includes(key)))) {
      return NextResponse.json({ error: "Body role tidak valid; gunakan API akses dengan grants dan expectedRevision" }, { status: 400 });
    }
    if (remove || body.action === "delete") {
      await deleteRole(db, session.company_id, id);
      return NextResponse.json({ message: "Role dihapus" });
    }
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Nama role harus diisi" }, { status: 400 });
    }
    const { error } = await updateCompanyRole(id, session.company_id, body.name.trim());
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ message: "Role diupdate" });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: NextRequest, context: Context) { return mutate(request, context, false); }
export async function DELETE(request: NextRequest, context: Context) { return mutate(request, context, true); }
