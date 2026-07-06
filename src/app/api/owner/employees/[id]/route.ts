import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@/types";
import {
  updateEmployee,
  toggleEmployeeStatus,
  resetEmployeePin,
  deleteEmployee,
} from "@/lib/supabase/queries.owner";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  // Toggle status
  if (body.toggle_status === true) {
    const { error, status } = await toggleEmployeeStatus(
      params.id,
      session.company_id
    );
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ status });
  }

  // Reset PIN
  if (body.reset_pin === true) {
    if (!body.new_pin || !/^\d{6}$/.test(String(body.new_pin))) {
      return NextResponse.json(
        { error: "PIN baru harus 6 digit angka" },
        { status: 400 }
      );
    }
    const { error } = await resetEmployeePin(
      params.id,
      session.company_id,
      String(body.new_pin)
    );
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  // Update biasa
  const { name, username, roleId, allOutlets, outletIds } = body;

  const { error } = await updateEmployee({
    employeeId: params.id,
    companyId: session.company_id,
    name: name !== undefined ? String(name).trim() : undefined,
    username: username !== undefined ? String(username).trim() : undefined,
    roleId: roleId !== undefined ? String(roleId) : undefined,
    allOutlets: allOutlets !== undefined ? !!allOutlets : undefined,
    outletIds: Array.isArray(outletIds) ? outletIds : undefined,
  });

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { error } = await deleteEmployee(params.id, session.company_id);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ success: true });
}
