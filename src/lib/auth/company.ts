import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";

export async function verifyCompanyLogin(code: string, password: string) {
  const supabase = createAdminClient();

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("code", code)
    .eq("status", "active")
    .single();

  if (!company) return { company: null, error: "Perusahaan tidak ditemukan" };

  const valid = await bcrypt.compare(password, company.password_hash);
  if (!valid) return { company: null, error: "Password perusahaan salah" };

  return {
    company: {
      id: company.id,
      code: company.code,
      name: company.name,
    },
    error: null,
  };
}

export async function getActiveOutlets(companyId: string) {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("outlets")
    .select("id, name, address")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("name");

  return data ?? [];
}

export async function getAccountsForOutlet(companyId: string, outletId: string) {
  const supabase = createAdminClient();

  const { data: direct } = await supabase
    .from("users")
    .select("id, name, username, avatar_url, all_outlets, role_id, roles!inner(name)")
    .eq("company_id", companyId)
    .eq("status", "active");

  if (!direct) return [];

  const { data: userOutletData } = await supabase
    .from("user_outlets")
    .select("user_id")
    .eq("outlet_id", outletId);

  const assignedUserIds = new Set((userOutletData ?? []).map((u) => u.user_id));

  return direct.filter(
    (user) => user.all_outlets || assignedUserIds.has(user.id)
  ).map((user) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    avatar_url: user.avatar_url,
    role_name: (user as unknown as { roles: { name: string } }).roles?.name ?? "",
  }));
}
