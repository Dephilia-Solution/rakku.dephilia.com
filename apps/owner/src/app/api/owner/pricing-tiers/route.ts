import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@rakku/shared-types";
import {
  getCompanyPricingTiers,
  createCompanyPricingTier,
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

  const tiers = await getCompanyPricingTiers(session.company_id, outletId);
  return NextResponse.json({ tiers });
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

  const { outlet_id, name, slug, sort_order } = body;

  if (!outlet_id) {
    return NextResponse.json({ error: "Outlet wajib dipilih" }, { status: 400 });
  }
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
  }
  if (!slug || !String(slug).trim()) {
    return NextResponse.json({ error: "Slug wajib diisi" }, { status: 400 });
  }

  const { tier, error } = await createCompanyPricingTier({
    companyId: session.company_id,
    outletId: String(outlet_id),
    name: String(name).trim(),
    slug: String(slug).trim(),
    sortOrder: Number(sort_order) || 0,
  });

  if (error || !tier) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ tier }, { status: 201 });
}
