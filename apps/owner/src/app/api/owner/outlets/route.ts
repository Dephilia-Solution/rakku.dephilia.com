import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/supabase-clients";
import { checkLimit } from "@rakku/plans";
import type { OwnerSession } from "@rakku/shared-types";
import {
  getOwnerOutlets,
  createOutlet,
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

  const outlets = await getOwnerOutlets(session.company_id);
  return NextResponse.json({ outlets });
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

  const { name, address } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Nama outlet harus diisi" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const limit = await checkLimit(supabase, session.company_id, "outlets");
  if (!limit.allowed) {
    return NextResponse.json(limit, { status: 403 });
  }

  const { outlet, error } = await createOutlet({
    companyId: session.company_id,
    name: name.trim(),
    address: address?.trim() || undefined,
  });

  if (error || !outlet) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json(
    { outlet: { id: outlet.id, name: name.trim() } },
    { status: 201 }
  );
}
