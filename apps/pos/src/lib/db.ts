import { createTenantClient, createAdminClient as createPlatformClient } from "@rakku/db";
import { headers } from "next/headers";
import { getTenantSessionFromCookies } from "./auth/tenant-session";

export function createAdminClient() {
  return createTenantClient(async () => {
    const session = await getTenantSessionFromCookies();
    if (!session) return null;
    const context = await headers();
    const apiPath = context.get("x-rakku-api-path");
    const path = apiPath ?? context.get("x-rakku-path");
    const method = context.get("x-rakku-api-method") ?? "GET";
    if (path) {
      const section = apiPath ? path.startsWith("/api/reports/") ? "reports" : path.split("/")[3] : path.split("/")[1];
      const read = method === "GET" || method === "HEAD";
      const menus: Record<string, string[]> = {
        products: read && apiPath ? ["products", "register"] : ["products"],
        categories: read ? ["products", "register"] : ["products"],
        modifiers: read ? ["products", "register"] : ["products"],
        "pricing-options": read ? ["products", "register"] : ["products"],
        "pricing-tiers": read ? ["products", "register"] : ["products"],
        "product-tier-prices": read ? ["products", "register"] : ["products"],
        "modifier-tier-prices": read ? ["products", "register"] : ["products"],
        orders: method === "POST" ? ["register"] : ["register", "orders"], recipes: ["products", "ingredients"],
        ingredients: ["ingredients"], purchases: ["purchases"], expenses: ["expenses"],
        tables: read || method === "PATCH" ? ["tables", "register"] : ["tables"],
        taxes: read ? ["tax-discounts", "taxes", "register"] : ["tax-discounts", "taxes"],
        discounts: read ? ["tax-discounts", "discounts", "register"] : ["tax-discounts", "discounts"],
        reports: ["reports"],
        register: ["register"], "tax-discounts": ["tax-discounts", "taxes", "discounts"],
      };
      const slugs = menus[section];
      if (slugs) {
        const permissions = await createPlatformClient().from("role_menu_access")
          .select("can_view, menus!inner(slug)")
          .eq("role_id", session.role_id).in("menus.slug", slugs);
        // Owner/Superadmin UI currently assigns menu-level access (can_view),
        // not separate CRUD grants. Enforce that existing contract server-side.
        if (permissions.error || !permissions.data?.some(row => row.can_view)) {
          throw Object.assign(new Error("Forbidden"), { code: "42501" });
        }
      }
    }
    return session;
  });
}
