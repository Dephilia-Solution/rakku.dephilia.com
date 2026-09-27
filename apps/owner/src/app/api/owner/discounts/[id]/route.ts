import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@rakku/shared-types";
import {
  updateCompanyDiscount,
  deleteCompanyDiscount,
} from "@/lib/supabase/queries.data";

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

  const { searchParams } = new URL(request.url);
  const scope = (searchParams.get("scope") || "product") as "product" | "order";

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { name, type, value, start_date, end_date, is_active, product_id } = body;

  const { error } = await updateCompanyDiscount({
    discountId: params.id,
    companyId: session.company_id,
    scope,
    name: name !== undefined ? String(name).trim() : undefined,
    type,
    value: value !== undefined ? Number(value) : undefined,
    startDate: start_date !== undefined ? String(start_date) : undefined,
    endDate: end_date !== undefined ? String(end_date) : undefined,
    isActive: is_active !== undefined ? Boolean(is_active) : undefined,
    productId: product_id !== undefined ? String(product_id) : undefined,
  });

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
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

  const { searchParams } = new URL(request.url);
  const scope = (searchParams.get("scope") || "product") as "product" | "order";

  const { error } = await deleteCompanyDiscount(
    params.id,
    session.company_id,
    scope
  );
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ success: true });
}
