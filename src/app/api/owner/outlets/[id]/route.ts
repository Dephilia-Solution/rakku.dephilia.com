import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@/types";
import {
  updateOutlet,
  toggleOutletStatus,
  deleteOutlet,
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

  // Toggle status jika diminta
  if (body.toggle_status === true) {
    const { error, status } = await toggleOutletStatus(
      params.id,
      session.company_id
    );
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ status });
  }

  const { name, address } = body;

  const { error } = await updateOutlet({
    outletId: params.id,
    companyId: session.company_id,
    name: name !== undefined ? String(name).trim() : undefined,
    address: address !== undefined ? String(address).trim() : undefined,
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

  const { error } = await deleteOutlet(params.id, session.company_id);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ success: true });
}
