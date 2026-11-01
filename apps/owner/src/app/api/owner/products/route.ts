import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { createAdminClient } from "@rakku/db";
import { saveOwnerProduct } from "@rakku/db/owner-products";
import { runFinancialCommand } from "@rakku/db/financial-commands";
import { InventoryError } from "@rakku/db/owner-inventory";
import { ownerInventoryScope, inventoryId, inventoryErrorResponse } from "@/lib/inventory-api";
import { checkLimit } from "@rakku/plans";
import type { OwnerSession } from "@rakku/shared-types";
import {
  getOutletProducts,
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
    return NextResponse.json(
      { error: "outlet_id wajib diisi" },
      { status: 400 }
    );
  }

  const products = await getOutletProducts(session.company_id, outletId);
  return NextResponse.json({ products });
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

  const { outlet_id, name, category_id } = body;

  if (!outlet_id || !(await verifyOutletBelongsToCompany(String(outlet_id), session.company_id))) {
    return NextResponse.json({ error: "Outlet tidak valid" }, { status: 400 });
  }
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Nama produk wajib diisi" }, { status: 400 });
  }
  if (!category_id) {
    return NextResponse.json({ error: "Kategori wajib dipilih" }, { status: 400 });
  }

  const supabase = createAdminClient();
  try {
    const scope = await ownerInventoryScope(outlet_id);
    const data = await runFinancialCommand(supabase, { companyId: scope.companyId,
      requestId: body.request_id == null ? null : inventoryId(body.request_id, "Request ID"),
      command: "owner.product.create", payload: { scope, ...body, request_id: undefined },
      execute: tx => saveOwnerProduct(tx, scope, body, { checkQuota: async db => (await checkLimit(db, scope.companyId, "products")).allowed }),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) { return inventoryErrorResponse(error); }
}

export async function PATCH(request: NextRequest) {
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

  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "ID produk wajib diisi" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    inventoryId(id);
    const { data: previous, error } = await db.from("products").select("outlet_id")
      .eq("id", id).eq("company_id", session.company_id).maybeSingle();
    if (error || !previous) throw new InventoryError("Produk tidak ditemukan", 404);
    const scope = await ownerInventoryScope(previous.outlet_id);
    return NextResponse.json(await saveOwnerProduct(db, scope, body, { productId: id }));
  } catch (error) { return inventoryErrorResponse(error); }
}

export async function DELETE(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID produk wajib diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("company_id", session.company_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
