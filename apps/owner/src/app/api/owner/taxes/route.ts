import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@rakku/shared-types";
import { getCompanyTaxes, createCompanyTax } from "@/lib/supabase/queries.data";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

export async function GET(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const outletId = searchParams.get("outlet_id") || undefined;

  const taxes = await getCompanyTaxes(session.company_id, outletId);
  return NextResponse.json({ taxes });
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

  const { outlet_id, name, type, value, sort_order } = body;

  if (!outlet_id) {
    return NextResponse.json({ error: "Outlet wajib dipilih" }, { status: 400 });
  }
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
  }
  if (type !== "percentage" && type !== "fixed") {
    return NextResponse.json({ error: "Tipe tidak valid" }, { status: 400 });
  }
  if (Number(value) <= 0) {
    return NextResponse.json({ error: "Nilai harus lebih dari 0" }, { status: 400 });
  }

  const { tax, error } = await createCompanyTax({
    companyId: session.company_id,
    outletId: String(outlet_id),
    name: String(name).trim(),
    type,
    value: Number(value),
    sortOrder: Number(sort_order) || 0,
  });

  if (error || !tax) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ tax }, { status: 201 });
}
