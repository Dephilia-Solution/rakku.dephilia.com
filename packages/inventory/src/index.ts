import type { SupabaseClient } from "@supabase/supabase-js";

type JsonLike = Record<string, unknown>;

interface RecipeWithIngredient extends JsonLike {
  product_id: string;
  ingredient_id: string;
  quantity_used: number;
  ingredients: { company_id: string; outlet_id: string } | null;
}

interface OrderItemRow extends JsonLike {
  product_id: string;
  quantity: number;
}

/**
 * Potong stok otomatis (best-effort) untuk order yang baru selesai.
 *
 * Strategi (keputusan v5 M2): dipanggil SETELAH order + order_items tersimpan,
 * TIDAK dalam transaksi yang sama. Gagal di sini TIDAK menggagalkan order —
 * error cukup di-log ("best-effort").
 *
 * Idempotent: jika sudah ada stock_movements type=sale_deduction untuk order
 * ini, langsung skip (cegah double-deduct saat retry/webhook+polling).
 */
export async function deductStockForOrder(
  supabase: SupabaseClient,
  orderId: string,
  companyId: string | null,
  outletId: string | null,
  createdBy: string | null = null
): Promise<void> {
  try {
    const company = companyId;
    const outlet = outletId;

    if (!company || !outlet) {
      console.error(
        "[stock] deductStockForOrder skipped: missing company/outlet scope",
        { orderId }
      );
      return;
    }

    const { count: existingCount, error: countError } = await supabase
      .from("stock_movements")
      .select("id", { count: "exact", head: true })
      .eq("reference_id", orderId)
      .eq("type", "sale_deduction");

    if (countError) {
      console.error("[stock] idempotency check failed:", countError);
      return;
    }

    if ((existingCount ?? 0) > 0) {
      return;
    }

    const { data: itemRows, error: itemsError } = await supabase
      .from("order_items")
      .select("product_id, quantity")
      .eq("order_id", orderId);

    if (itemsError) {
      console.error("[stock] failed to fetch order_items:", itemsError);
      return;
    }

    const items = (itemRows ?? []) as OrderItemRow[];
    const productIds = Array.from(new Set(items.map((i) => i.product_id)));

    if (productIds.length === 0) {
      return;
    }

    const { data: recipeRows, error: recipesError } = await supabase
      .from("product_recipes")
      .select(
        "product_id, ingredient_id, quantity_used, ingredients(company_id, outlet_id)"
      )
      .in("product_id", productIds);

    if (recipesError) {
      console.error("[stock] failed to fetch product_recipes:", recipesError);
      return;
    }

    const recipes = (recipeRows ?? []) as unknown as RecipeWithIngredient[];

    const deductions = new Map<
      string,
      { quantity: number; ingredientId: string }
    >();

    for (const item of items) {
      for (const recipe of recipes) {
        if (recipe.product_id !== item.product_id) continue;

        const ingredientScope = recipe.ingredients;
        if (
          !ingredientScope ||
          ingredientScope.company_id !== company ||
          ingredientScope.outlet_id !== outlet
        ) {
          continue;
        }

        const current = deductions.get(recipe.ingredient_id) ?? {
          quantity: 0,
          ingredientId: recipe.ingredient_id,
        };
        current.quantity += recipe.quantity_used * item.quantity;
        deductions.set(recipe.ingredient_id, current);
      }
    }

    const ingredientIds = Array.from(deductions.keys());

    if (ingredientIds.length === 0) {
      return;
    }

    const { data: ingredientRows, error: ingredientsError } = await supabase
      .from("ingredients")
      .select("id, stock_quantity")
      .in("id", ingredientIds);

    if (ingredientsError) {
      console.error("[stock] failed to fetch ingredients:", ingredientsError);
      return;
    }

    const stockMap = new Map<string, number>(
      (ingredientRows ?? []).map((r: JsonLike) => [
        r.id as string,
        Number(r.stock_quantity ?? 0),
      ])
    );

    const movementRows = Array.from(deductions.values()).map((d) => ({
      company_id: company,
      outlet_id: outlet,
      ingredient_id: d.ingredientId,
      type: "sale_deduction" as const,
      quantity_change: -d.quantity,
      reference_id: orderId,
      note: null,
      created_by: createdBy,
    }));

    const updates = movementRows.map((m) => {
      const current = stockMap.get(m.ingredient_id) ?? 0;
      return supabase
        .from("ingredients")
        .update({ stock_quantity: current + m.quantity_change })
        .eq("id", m.ingredient_id)
        .eq("company_id", company)
        .eq("outlet_id", outlet);
    });

    const updateResults = await Promise.all(updates);

    for (const result of updateResults) {
      if (result.error) {
        console.error(
          "[stock] failed to update ingredient stock:",
          result.error
        );
        return;
      }
    }

    const { error: movementsError } = await supabase
      .from("stock_movements")
      .insert(movementRows);

    if (movementsError) {
      console.error("[stock] failed to insert stock_movements:", movementsError);
      return;
    }
  } catch (err) {
    console.error("[stock] unexpected error deducting stock:", err);
  }
}
