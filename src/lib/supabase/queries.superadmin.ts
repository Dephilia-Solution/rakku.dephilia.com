import { createClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";

// ─── Companies ───

export async function getCompanies() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .order("name");
  return data ?? [];
}

export async function createCompany(data: {
  code: string;
  name: string;
  password: string;
  logo_url?: string;
}) {
  const supabase = await createClient();
  const password_hash = await bcrypt.hash(data.password, 10);

  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      code: data.code.toUpperCase(),
      name: data.name,
      password_hash,
      logo_url: data.logo_url || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return company;
}

export async function updateCompany(
  id: string,
  data: { name?: string; code?: string; status?: string; password?: string; logo_url?: string | null }
) {
  const supabase = await createClient();
  const updates: Record<string, unknown> = {};

  if (data.name) updates.name = data.name;
  if (data.code) updates.code = data.code.toUpperCase();
  if (data.status) updates.status = data.status;
  if (data.password) updates.password_hash = await bcrypt.hash(data.password, 10);
  if (data.logo_url !== undefined) updates.logo_url = data.logo_url;

  const { error } = await supabase.from("companies").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Outlets ───

export async function getOutlets(companyId?: string) {
  const supabase = await createClient();
  let query = supabase.from("outlets").select("*, companies(name)");
  if (companyId) query = query.eq("company_id", companyId);
  const { data } = await query.order("name");
  return data ?? [];
}

export async function createOutlet(data: {
  company_id: string;
  name: string;
  address?: string;
}) {
  const supabase = await createClient();
  const { data: outlet, error } = await supabase
    .from("outlets")
    .insert({ company_id: data.company_id, name: data.name, address: data.address || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return outlet;
}

export async function updateOutlet(id: string, data: { name?: string; address?: string; status?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from("outlets").update(data).eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Menus ───

export async function getMenus() {
  const supabase = await createClient();
  const { data } = await supabase.from("menus").select("*").order("sort_order");
  return data ?? [];
}

export async function createMenu(data: { slug: string; name: string; icon?: string; path: string; sort_order?: number }) {
  const supabase = await createClient();
  const { data: menu, error } = await supabase
    .from("menus")
    .insert({ slug: data.slug, name: data.name, icon: data.icon || null, path: data.path, sort_order: data.sort_order ?? 0 })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return menu;
}

export async function updateMenu(id: string, data: { slug?: string; name?: string; icon?: string; path?: string; sort_order?: number }) {
  const supabase = await createClient();
  const { error } = await supabase.from("menus").update(data).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteMenu(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("menus").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Roles ───

export async function getRoles(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  return data ?? [];
}

export async function createRole(companyId: string, name: string) {
  const supabase = await createClient();
  const { data: role, error } = await supabase
    .from("roles")
    .insert({ company_id: companyId, name })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return role;
}

export async function updateRole(id: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("roles").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRole(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Role-Menu Access ───

export async function getRoleMenuAccess(companyId: string) {
  const supabase = await createClient();
  const { data: roles } = await supabase
    .from("roles")
    .select("id, name")
    .eq("company_id", companyId)
    .order("name");

  const { data: menus } = await supabase
    .from("menus")
    .select("*")
    .order("sort_order");

  const { data: access } = await supabase
    .from("role_menu_access")
    .select("*");

  return {
    roles: roles ?? [],
    menus: menus ?? [],
    access: access ?? [],
  };
}

export async function setRoleMenuAccess(
  roleId: string,
  menuId: string,
  canView: boolean
) {
  const supabase = await createClient();

  if (canView) {
    const { error } = await supabase
      .from("role_menu_access")
      .upsert(
        { role_id: roleId, menu_id: menuId, can_view: true },
        { onConflict: "role_id, menu_id" }
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("role_menu_access")
      .delete()
      .eq("role_id", roleId)
      .eq("menu_id", menuId);
    if (error && error.code !== "PGRST116") throw new Error(error.message);
  }
}

// ─── Users ───

export async function getUsers(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("*, roles(name), companies(name)")
    .eq("company_id", companyId)
    .order("name");
  return data ?? [];
}

export async function createUser(data: {
  company_id: string;
  role_id: string;
  name: string;
  username: string;
  pin: string;
  all_outlets?: boolean;
  outlet_ids?: string[];
}) {
  const supabase = await createClient();
  const pin_hash = await bcrypt.hash(data.pin, 10);

  const { data: user, error } = await supabase
    .from("users")
    .insert({
      company_id: data.company_id,
      role_id: data.role_id,
      name: data.name,
      username: data.username,
      pin_hash,
      all_outlets: data.all_outlets ?? false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Assign outlets
  if (data.outlet_ids && data.outlet_ids.length > 0) {
    const outletAssignments = data.outlet_ids.map((oid) => ({
      user_id: user.id,
      outlet_id: oid,
    }));
    const { error: outletsError } = await supabase
      .from("user_outlets")
      .insert(outletAssignments);
    if (outletsError) throw new Error(outletsError.message);
  }

  return user;
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    username?: string;
    role_id?: string;
    pin?: string;
    status?: string;
    all_outlets?: boolean;
    outlet_ids?: string[];
  }
) {
  const supabase = await createClient();
  const updates: Record<string, unknown> = {};

  if (data.name) updates.name = data.name;
  if (data.username) updates.username = data.username;
  if (data.role_id) updates.role_id = data.role_id;
  if (data.status) updates.status = data.status;
  if (data.all_outlets !== undefined) updates.all_outlets = data.all_outlets;
  if (data.pin) updates.pin_hash = await bcrypt.hash(data.pin, 10);

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("users").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
  }

  // Update outlet assignments
  if (data.outlet_ids) {
    await supabase.from("user_outlets").delete().eq("user_id", id);
    if (data.outlet_ids.length > 0) {
      const assignments = data.outlet_ids.map((oid) => ({
        user_id: id,
        outlet_id: oid,
      }));
      const { error } = await supabase.from("user_outlets").insert(assignments);
      if (error) throw new Error(error.message);
    }
  }
}
