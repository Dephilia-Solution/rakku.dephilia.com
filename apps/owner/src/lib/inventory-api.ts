import { NextResponse } from "next/server";
import { createAdminClient, type DatabaseClient } from "@rakku/db";
import { assertOwnerOutlet, InventoryError, type OwnerOutletScope } from "@rakku/db/owner-inventory";
import { FinancialCommandError } from "@rakku/db/financial-commands";
import { checkFeature } from "@rakku/plans";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";

export function inventoryId(value: unknown, label = "ID"): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
    throw new InventoryError(`${label} tidak valid`);
  }
  return value;
}
export async function ownerInventoryScope(outletId: unknown): Promise<OwnerOutletScope> {
  const session = await getOwnerSessionFromCookies();
  if (!session?.company_id) throw new InventoryError("Sesi berakhir", 401);
  const scope = { companyId: session.company_id, ownerId: session.owner_id, outletId: inventoryId(outletId, "Outlet") };
  await assertOwnerOutlet(createAdminClient(), scope);
  return scope;
}
export async function requireAdvancedInventory(db: DatabaseClient, companyId: string) {
  if (!(await checkFeature(db, companyId, "inventory_advanced")).allowed) {
    throw new InventoryError("Pembelian dan stok opname memerlukan fitur inventori lanjutan", 403, "PLAN_LIMIT");
  }
}
export function inventoryErrorResponse(error: unknown) {
  if (error instanceof InventoryError || error instanceof FinancialCommandError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: "Gagal memproses inventori. Silakan coba lagi." }, { status: 500 });
}
export function inventoryPage(params: URLSearchParams) {
  const page = Number(params.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new InventoryError("Halaman tidak valid");
  return { page, pageSize: 20, offset: (page - 1) * 20 };
}
