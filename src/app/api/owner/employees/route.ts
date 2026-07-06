import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@/types";
import {
  getOwnerEmployees,
  createEmployee,
  getCompanyRoles,
  getOwnerOutlets,
} from "@/lib/supabase/queries.owner";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const [employees, roles, outlets] = await Promise.all([
    getOwnerEmployees(session.company_id),
    getCompanyRoles(session.company_id),
    getOwnerOutlets(session.company_id),
  ]);

  return NextResponse.json({ employees, roles, outlets });
}

export async function POST(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { name, username, pin, roleId, allOutlets, outletIds } = body;

  // Validasi
  if (!name || !username || !pin || !roleId) {
    return NextResponse.json(
      { error: "Nama, username, PIN, dan role harus diisi" },
      { status: 400 }
    );
  }

  if (!/^\d{6}$/.test(String(pin))) {
    return NextResponse.json(
      { error: "PIN harus 6 digit angka" },
      { status: 400 }
    );
  }

  if (!allOutlets && (!Array.isArray(outletIds) || outletIds.length === 0)) {
    return NextResponse.json(
      { error: "Pilih minimal 1 outlet untuk karyawan ini" },
      { status: 400 }
    );
  }

  const { employee, error } = await createEmployee({
    companyId: session.company_id,
    name: String(name).trim(),
    username: String(username).trim(),
    pin: String(pin),
    roleId,
    allOutlets: !!allOutlets,
    outletIds: Array.isArray(outletIds) ? outletIds : [],
  });

  if (error || !employee) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json(
    { employee: { id: employee.id } },
    { status: 201 }
  );
}
