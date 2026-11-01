import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@rakku/db";
import { runFinancialCommand } from "@rakku/db/financial-commands";
import { InventoryError, assertOwnerOutlet } from "@rakku/db/owner-inventory";
import { adjustStock } from "@rakku/inventory";
import { ownerInventoryScope, inventoryId, inventoryErrorResponse, requireAdvancedInventory } from "@/lib/inventory-api";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) throw new InventoryError("Body tidak valid");
    const scope = await ownerInventoryScope(body.outlet_id);
    const ingredientId = inventoryId((await params).id);
    const requestId = inventoryId(body.request_id, "Request ID");
    if (typeof body.note !== "string" || !body.note.trim() || body.note.length > 1000) throw new InventoryError("Alasan stok opname wajib diisi, maksimal 1000 karakter");
    const note = body.note.trim();
    const result = await runFinancialCommand(createAdminClient(), {
      companyId: scope.companyId, requestId, command: "owner.inventory.adjust",
      payload: { scope, ingredientId, quantity: body.quantity, note },
      execute: async tx => {
        await assertOwnerOutlet(tx, scope);
        await requireAdvancedInventory(tx, scope.companyId);
        return adjustStock(tx, { ...scope, userId: null, ingredientId, quantity: body.quantity, note });
      },
    });
    return NextResponse.json(result);
  } catch (error) { return inventoryErrorResponse(error); }
}
