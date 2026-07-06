import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@/types";
import {
  updateCompanyRole,
  deleteCompanyRole,
  getRoleCompanyId,
} from "@/lib/supabase/queries.owner";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

// PATCH: rename role / hapus role (via body.action = "delete")
export async function PATCH(
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

  // Cek role milik company ini
  const roleCompanyId = await getRoleCompanyId(id);
  if (!roleCompanyId || roleCompanyId !== session.company_id) {
    return NextResponse.json({ error: "Role tidak ditemukan" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  if (body.action === "delete") {
    const { error } = await deleteCompanyRole(id, session.company_id);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ message: "Role dihapus" });
  }

  if (!body.name) {
    return NextResponse.json(
      { error: "Nama role harus diisi" },
      { status: 400 }
    );
  }

  const { error } = await updateCompanyRole(
    id,
    session.company_id,
    String(body.name).trim()
  );

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ message: "Role diupdate" });
}

// DELETE: hapus role
export async function DELETE(
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

  const { error } = await deleteCompanyRole(id, session.company_id);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ message: "Role dihapus" });
}
