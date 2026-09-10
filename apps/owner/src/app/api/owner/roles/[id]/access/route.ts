import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { checkFeature } from "@rakku/plans";
import type { OwnerSession } from "@rakku/shared-types";
import {
  getRoleCompanyId,
  getRoleMenuAccessIds,
  setCompanyRoleMenuAccess,
} from "@/lib/supabase/queries.owner";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

// GET: list menu_id yang diizinkan untuk role ini
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { id } = await params;

  const roleCompanyId = await getRoleCompanyId(id);
  if (!roleCompanyId || roleCompanyId !== session.company_id) {
    return NextResponse.json({ error: "Role tidak ditemukan" }, { status: 404 });
  }

  const menuAccess = await getRoleMenuAccessIds(id);
  return NextResponse.json({ menu_access: menuAccess });
}

// POST: toggle akses menu untuk role
// Body: { menuId: string, canView: boolean }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { id } = await params;

  const roleCompanyId = await getRoleCompanyId(id);
  if (!roleCompanyId || roleCompanyId !== session.company_id) {
    return NextResponse.json({ error: "Role tidak ditemukan" }, { status: 404 });
  }

  const feature = await checkFeature(
    createAdminClient(),
    session.company_id,
    "custom_roles"
  );
  if (!feature.allowed) {
    return NextResponse.json(feature, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.menuId || typeof body.canView !== "boolean") {
    return NextResponse.json(
      { error: "menuId dan canView (boolean) harus diisi" },
      { status: 400 }
    );
  }

  const { error } = await setCompanyRoleMenuAccess(
    id,
    String(body.menuId),
    Boolean(body.canView)
  );

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ message: "Akses menu diupdate" });
}
