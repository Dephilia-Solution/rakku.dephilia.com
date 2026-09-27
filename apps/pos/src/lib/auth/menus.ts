import { createAdminClient } from "@rakku/supabase-clients";
import type { Menu } from "@rakku/shared-types";

export async function getAllowedMenus(roleId: string): Promise<Menu[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("role_menu_access")
    .select("menus!inner(id, slug, name, icon, path, sort_order)")
    .eq("role_id", roleId)
    .eq("can_view", true)
    .order("sort_order", { referencedTable: "menus" });

  if (!data) return [];

  return data.map((r) => {
    const m = (r as unknown as { menus: { id: string; slug: string; name: string; icon: string; path: string; sort_order: number } }).menus;
    return {
      id: m.id,
      slug: m.slug,
      name: m.name,
      icon: m.icon,
      path: m.path,
      sort_order: m.sort_order,
    };
  });
}

export async function getAllMenus(): Promise<Menu[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("menus")
    .select("*")
    .order("sort_order");

  return (data ?? []).map((m) => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    icon: m.icon,
    path: m.path,
    sort_order: m.sort_order,
  }));
}
