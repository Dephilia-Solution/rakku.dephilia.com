import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/db";
import { getRoleGrants } from "@rakku/db/roles-access";
import { checkFeature } from "@rakku/plans";
import type { OwnerSession } from "@rakku/shared-types";
import {
  getCompanyRoles,
  createCompanyRole,
  getAllSystemMenus,
} from "@/lib/supabase/queries.owner";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

// GET: list roles + menus + access map per role (untuk matriks Kelola Role)
export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  try {
  const [roles, menus] = await Promise.all([
    getCompanyRoles(session.company_id),
    getAllSystemMenus(),
  ]);

  // Ambil akses menu per role
  const rolesWithAccess = await Promise.all(
    roles.map(async (r) => {
      const access = await getRoleGrants(createAdminClient(), session.company_id, r.id as string);
      return { id: r.id as string, name: r.name as string, ...access,
        menu_access: access.grants.filter(g => g.can_view).map(g => g.menu_id) };
    })
  );

  return NextResponse.json({ roles: rolesWithAccess, menus });
  } catch {
    return NextResponse.json({ error: "Gagal memuat role" }, { status: 500 });
  }
}

// POST: buat role baru
export async function POST(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim() || Object.keys(body).some(key => key !== "name")) {
    return NextResponse.json(
      { error: "Nama role harus diisi" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const feature = await checkFeature(
    supabase,
    session.company_id,
    "custom_roles"
  );
  if (!feature.allowed) {
    return NextResponse.json(feature, { status: 403 });
  }

  const { role, error } = await createCompanyRole(
    session.company_id,
    String(body.name).trim()
  );

  if (error || !role) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ role }, { status: 201 });
}
