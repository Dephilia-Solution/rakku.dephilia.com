import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@rakku/shared-types";
import {
  getCompanyProductDiscounts,
  getCompanyOrderDiscounts,
  createCompanyDiscount,
} from "@/lib/supabase/queries.data";

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

  const [productDiscounts, orderDiscounts] = await Promise.all([
    getCompanyProductDiscounts(session.company_id, outletId),
    getCompanyOrderDiscounts(session.company_id, outletId),
  ]);

  return NextResponse.json({ productDiscounts, orderDiscounts });
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

  const { outlet_id, scope, product_id, name, type, value, start_date, end_date } = body;

  if (!outlet_id) {
    return NextResponse.json({ error: "Outlet wajib dipilih" }, { status: 400 });
  }
  if (scope !== "product" && scope !== "order") {
    return NextResponse.json({ error: "Scope tidak valid" }, { status: 400 });
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
  if (!start_date || !end_date) {
    return NextResponse.json({ error: "Periode wajib diisi" }, { status: 400 });
  }

  const { discount, error } = await createCompanyDiscount({
    companyId: session.company_id,
    outletId: String(outlet_id),
    scope,
    productId: product_id ? String(product_id) : undefined,
    name: String(name).trim(),
    type,
    value: Number(value),
    startDate: String(start_date),
    endDate: String(end_date),
  });

  if (error || !discount) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ discount }, { status: 201 });
}
