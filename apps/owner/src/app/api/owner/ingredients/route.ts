import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@rakku/shared-types";
import {
  getCompanyIngredients,
  verifyOutletBelongsToCompany,
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
  const outletId = searchParams.get("outlet_id");

  if (!outletId) {
    return NextResponse.json({ error: "outlet_id wajib diisi" }, { status: 400 });
  }

  if (!(await verifyOutletBelongsToCompany(String(outletId), session.company_id))) {
    return NextResponse.json({ error: "Outlet tidak valid" }, { status: 400 });
  }

  const ingredients = await getCompanyIngredients(
    session.company_id,
    String(outletId)
  );
  return NextResponse.json(ingredients);
}
