import bcrypt from "bcryptjs";
import { createAdminClient } from "@rakku/supabase-clients";
import { hashPin } from "@rakku/auth-utils";
import type {
  Owner,
  OwnerWithCompany,
  OwnerDashboardOutlet,
  OwnerDashboardEmployee,
} from "@rakku/shared-types";

// ============================================================
// Helper: generate slug from name
// ============================================================
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================
// Helper: generate unique company code from name
// ============================================================
export function generateCompanyCode(name: string): string {
  const base = name
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return base || "BISNIS";
}

// ============================================================
// PASSWORD RESET — token hash & lookup
// ============================================================
export async function setOwnerResetToken(
  ownerId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("owners")
    .update({
      reset_token_hash: tokenHash,
      reset_token_expires_at: expiresAt.toISOString(),
    })
    .eq("id", ownerId);
  if (error) return { error: "Gagal membuat token reset" };
  return { error: null };
}

export async function getOwnerByValidResetToken(
  tokenHash: string
): Promise<{ owner: { id: string; email: string; name: string } | null; error: string | null }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("owners")
    .select("id, email, name, reset_token_expires_at")
    .eq("reset_token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return { owner: null, error: null };
  if (!data.reset_token_expires_at || new Date(data.reset_token_expires_at) < new Date()) {
    return { owner: null, error: "Token kadaluarsa" };
  }
  return {
    owner: { id: data.id as string, email: data.email as string, name: data.name as string },
    error: null,
  };
}

export async function clearOwnerResetToken(
  ownerId: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("owners")
    .update({ reset_token_hash: null, reset_token_expires_at: null })
    .eq("id", ownerId);
  if (error) return { error: "Gagal membersihkan token" };
  return { error: null };
}

export async function updateOwnerPassword(
  ownerId: string,
  newPassword: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const { error } = await supabase
    .from("owners")
    .update({ password_hash: passwordHash })
    .eq("id", ownerId);
  if (error) return { error: "Gagal memperbarui kata sandi" };
  return { error: null };
}

// ============================================================
// Helper: generate unique slug (append -2, -3, dst jika taken)
// ============================================================
async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  const supabase = createAdminClient();
  let slug = baseSlug || "bisnis";
  let counter = 1;

  while (true) {
    const { data } = await supabase
      .from("companies")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

async function ensureUniqueCode(baseCode: string): Promise<string> {
  const supabase = createAdminClient();
  let code = baseCode;
  let counter = 1;

  while (true) {
    const { data } = await supabase
      .from("companies")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (!data) return code;
    counter += 1;
    code = `${baseCode}${counter}`;
  }
}

// ============================================================
// REGISTER — buat owner baru
// ============================================================
export async function createOwner(params: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<{ owner: Owner | null; error: string | null }> {
  const supabase = createAdminClient();
  const { name, email, password, phone } = params;

  // Cek email sudah dipakai
  const { data: existing } = await supabase
    .from("owners")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existing) {
    return { owner: null, error: "Email sudah terdaftar" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { data: owner, error } = await supabase
    .from("owners")
    .insert({
      email: email.toLowerCase(),
      name,
      password_hash: passwordHash,
      phone: phone || null,
      is_active: true,
    })
    .select()
    .single();

  if (error || !owner) {
    return { owner: null, error: "Gagal mendaftar, coba lagi" };
  }

  return { owner: owner as Owner, error: null };
}

// ============================================================
// GET OWNER BY EMAIL
// ============================================================
export async function getOwnerByEmail(
  email: string
): Promise<{ owner: OwnerWithCompany | null; error: string | null }> {
  const supabase = createAdminClient();

  const { data: owner, error } = await supabase
    .from("owners")
    .select("*")
    .eq("email", email.toLowerCase())
    .single();

  if (error || !owner) {
    return { owner: null, error: "Akun tidak ditemukan" };
  }

  // Query company terpisah — relasi owners→companies adalah one-to-many
  // (Postgrest kembalikan array), jadi pakai .maybeSingle() untuk object tunggal.
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("owner_id", owner.id)
    .maybeSingle();

  return {
    owner: {
      ...owner,
      company_id: company?.id ?? null,
      company_name: company?.name ?? null,
      company_slug: company?.slug ?? null,
    } as OwnerWithCompany,
    error: null,
  };
}

// ============================================================
// VERIFY OWNER EMAIL
// ============================================================
export async function verifyOwnerEmail(
  ownerId: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("owners")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", ownerId);

  if (error) {
    return { error: "Gagal memverifikasi email" };
  }

  return { error: null };
}

// ============================================================
// LOGIN — verify owner login
// ============================================================
export async function verifyOwnerLogin(
  email: string,
  password: string
): Promise<{
  owner: Owner | null;
  company: { id: string; name: string; slug: string | null } | null;
  error: string | null;
}> {
  const supabase = createAdminClient();

  const { data: owner } = await supabase
    .from("owners")
    .select("*")
    .eq("email", email.toLowerCase())
    .single();

  if (!owner) {
    return { owner: null, company: null, error: "Email tidak ditemukan" };
  }

  if (!owner.is_active) {
    return { owner: null, company: null, error: "Akun Anda dinonaktifkan" };
  }

  const valid = await bcrypt.compare(password, owner.password_hash);
  if (!valid) {
    return { owner: null, company: null, error: "Password salah" };
  }

  // Update last_login_at
  await supabase
    .from("owners")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", owner.id);

  // Cek company milik owner
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("owner_id", owner.id)
    .maybeSingle();

  return {
    owner: owner as Owner,
    company: company
      ? { id: company.id, name: company.name, slug: company.slug }
      : null,
    error: null,
  };
}

// ============================================================
// Get owner with company info
// ============================================================
export async function getOwnerWithCompany(ownerId: string) {
  const supabase = createAdminClient();

  const { data: owner } = await supabase
    .from("owners")
    .select("id, email, name, phone")
    .eq("id", ownerId)
    .single();

  if (!owner) return null;

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, code, logo_url")
    .eq("owner_id", ownerId)
    .maybeSingle();

  return {
    ...owner,
    company_id: company?.id ?? null,
    company_name: company?.name ?? null,
    company_slug: company?.slug ?? null,
    company_code: company?.code ?? null,
    company_logo_url: company?.logo_url ?? null,
  };
}

// ============================================================
// ONBOARDING — buat company + outlet + seed roles
// ============================================================
export async function createCompanyWithOnboarding(params: {
  ownerId: string;
  companyName: string;
  companyCode: string;
  companyPassword: string;
  outletName: string;
  outletAddress?: string;
}): Promise<{
  company: { id: string; name: string; slug: string; code: string } | null;
  error: string | null;
}> {
  const supabase = createAdminClient();
  const { ownerId, companyName, companyPassword, outletName, outletAddress } =
    params;

  // Cek owner belum punya company
  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (existingCompany) {
    return { company: null, error: "Anda sudah memiliki perusahaan" };
  }

  // Generate unique code & slug
  const baseCode = generateCompanyCode(companyName);
  const code = await ensureUniqueCode(baseCode);
  const baseSlug = generateSlug(companyName);
  const slug = await ensureUniqueSlug(baseSlug);

  const passwordHash = await bcrypt.hash(companyPassword, 10);

  // 1. Buat company
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      code,
      name: companyName,
      password_hash: passwordHash,
      status: "active",
      owner_id: ownerId,
      slug,
    })
    .select()
    .single();

  if (companyError || !company) {
    return { company: null, error: "Gagal membuat perusahaan" };
  }

  // 2. Buat outlet pertama
  const { error: outletError } = await supabase.from("outlets").insert({
    company_id: company.id,
    name: outletName,
    address: outletAddress || null,
    status: "active",
  });

  if (outletError) {
    // Rollback company
    await supabase.from("companies").delete().eq("id", company.id);
    return { company: null, error: "Gagal membuat outlet" };
  }

  // 3. Seed default pricing tiers (Dine In & Take Away)
  // Catatan: role & akses menu tidak di-seed di sini — Owner kelola sendiri
  // via menu "Kelola Role" di halaman Karyawan.
  const { data: outlet } = await supabase
    .from("outlets")
    .select("id")
    .eq("company_id", company.id)
    .eq("name", outletName)
    .maybeSingle();

  if (outlet) {
    await supabase.from("pricing_tiers").insert([
      {
        company_id: company.id,
        outlet_id: outlet.id,
        name: "Dine In",
        slug: "dine-in",
        is_active: true,
        sort_order: 0,
      },
      {
        company_id: company.id,
        outlet_id: outlet.id,
        name: "Take Away",
        slug: "take-away",
        is_active: true,
        sort_order: 1,
      },
    ]);
  }

  return {
    company: { id: company.id, name: company.name, slug, code },
    error: null,
  };
}

// ============================================================
// OUTLETS — CRUD untuk Owner
// ============================================================
export async function getOwnerOutlets(
  companyId: string
): Promise<OwnerDashboardOutlet[]> {
  const supabase = createAdminClient();

  const { data: outlets } = await supabase
    .from("outlets")
    .select("id, name, address, status, created_at, qr_menu_slug")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (!outlets) return [];

  // Ambil employee count per outlet
  const outletIds = outlets.map((o) => o.id);
  const { data: userOutlets } = await supabase
    .from("user_outlets")
    .select("outlet_id, user_id")
    .in("outlet_id", outletIds);

  const countMap = new Map<string, Set<string>>();
  for (const uo of userOutlets ?? []) {
    if (!countMap.has(uo.outlet_id)) countMap.set(uo.outlet_id, new Set());
    countMap.get(uo.outlet_id)!.add(uo.user_id);
  }

  // Tambah user dengan all_outlets = true ke semua outlet
  const { data: allOutletUsers } = await supabase
    .from("users")
    .select("id, company_id")
    .eq("company_id", companyId)
    .eq("all_outlets", true)
    .eq("status", "active");

  const allOutletUserIds = (allOutletUsers ?? []).map((u) => u.id);

  return outlets.map((o) => {
    const directCount = countMap.get(o.id)?.size ?? 0;
    return {
      id: o.id,
      name: o.name,
      address: o.address,
      status: o.status,
      created_at: o.created_at,
      qr_menu_slug: (o as Record<string, unknown>).qr_menu_slug as string | null,
      employee_count: directCount + allOutletUserIds.length,
    };
  });
}

export async function createOutlet(params: {
  companyId: string;
  name: string;
  address?: string;
}): Promise<{ outlet: { id: string } | null; error: string | null }> {
  const supabase = createAdminClient();

  // Cek nama unik per company
  const { data: existing } = await supabase
    .from("outlets")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("name", params.name)
    .maybeSingle();

  if (existing) {
    return { outlet: null, error: "Nama outlet sudah dipakai" };
  }

  const { data: outlet, error } = await supabase
    .from("outlets")
    .insert({
      company_id: params.companyId,
      name: params.name,
      address: params.address || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !outlet) {
    return { outlet: null, error: "Gagal membuat outlet" };
  }

  // Seed default pricing tiers untuk outlet baru
  await supabase.from("pricing_tiers").insert([
    {
      company_id: params.companyId,
      outlet_id: outlet.id,
      name: "Dine In",
      slug: "dine-in",
      is_active: true,
      sort_order: 0,
    },
    {
      company_id: params.companyId,
      outlet_id: outlet.id,
      name: "Take Away",
      slug: "take-away",
      is_active: true,
      sort_order: 1,
    },
  ]);

  return { outlet: { id: outlet.id }, error: null };
}

export async function updateOutlet(params: {
  outletId: string;
  companyId: string;
  name?: string;
  address?: string;
}): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  // Cek nama unik jika diubah
  if (params.name) {
    const { data: existing } = await supabase
      .from("outlets")
      .select("id")
      .eq("company_id", params.companyId)
      .eq("name", params.name)
      .neq("id", params.outletId)
      .maybeSingle();

    if (existing) {
      return { error: "Nama outlet sudah dipakai" };
    }
  }

  const updateData: Record<string, unknown> = {};
  if (params.name !== undefined) updateData.name = params.name;
  if (params.address !== undefined) updateData.address = params.address;

  const { error } = await supabase
    .from("outlets")
    .update(updateData)
    .eq("id", params.outletId)
    .eq("company_id", params.companyId);

  if (error) return { error: "Gagal mengupdate outlet" };
  return { error: null };
}

export async function toggleOutletStatus(
  outletId: string,
  companyId: string
): Promise<{ error: string | null; status: "active" | "inactive" | null }> {
  const supabase = createAdminClient();

  const { data: outlet } = await supabase
    .from("outlets")
    .select("status")
    .eq("id", outletId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!outlet) return { error: "Outlet tidak ditemukan", status: null };

  const newStatus = outlet.status === "active" ? "inactive" : "active";

  const { error } = await supabase
    .from("outlets")
    .update({ status: newStatus })
    .eq("id", outletId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal mengubah status", status: null };
  return { error: null, status: newStatus };
}

export async function deleteOutlet(
  outletId: string,
  companyId: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  // Cek apakah ini outlet terakhir (tidak boleh hapus outlet terakhir)
  const { count } = await supabase
    .from("outlets")
    .select("id", { count: "exact" })
    .eq("company_id", companyId);

  if (count !== null && count <= 1) {
    return { error: "Tidak bisa menghapus outlet terakhir" };
  }

  const { error } = await supabase
    .from("outlets")
    .delete()
    .eq("id", outletId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal menghapus outlet" };
  return { error: null };
}

// ============================================================
// EMPLOYEES — CRUD untuk Owner
// ============================================================
export async function getOwnerEmployees(
  companyId: string
): Promise<OwnerDashboardEmployee[]> {
  const supabase = createAdminClient();

  const { data: users } = await supabase
    .from("users")
    .select(
      "id, name, username, role_id, all_outlets, status, avatar_url, created_at, roles!inner(name)"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (!users) return [];

  const userIds = users.map((u) => u.id);
  const { data: userOutlets } = await supabase
    .from("user_outlets")
    .select("user_id, outlet_id, outlets!inner(id, name)")
    .in("user_id", userIds);

  const outletMap = new Map<string, { id: string; name: string }[]>();
  for (const uo of userOutlets ?? []) {
    if (!outletMap.has(uo.user_id)) outletMap.set(uo.user_id, []);
    const outlet = uo.outlets as unknown as { id: string; name: string };
    outletMap.get(uo.user_id)!.push({ id: outlet.id, name: outlet.name });
  }

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role_id: u.role_id,
    role_name:
      (u as unknown as { roles: { name: string } }).roles?.name ?? "",
    all_outlets: u.all_outlets,
    status: u.status,
    avatar_url: u.avatar_url,
    outlets: outletMap.get(u.id) ?? [],
    created_at: u.created_at,
  }));
}

export async function createEmployee(params: {
  companyId: string;
  name: string;
  username: string;
  pin: string;
  roleId: string;
  allOutlets: boolean;
  outletIds: string[];
}): Promise<{ employee: { id: string } | null; error: string | null }> {
  const supabase = createAdminClient();
  const { companyId, name, username, pin, roleId, allOutlets, outletIds } =
    params;

  // Cek username unik per company
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    return { employee: null, error: "Username sudah dipakai" };
  }

  const pinHash = await hashPin(pin);

  const { data: user, error } = await supabase
    .from("users")
    .insert({
      company_id: companyId,
      role_id: roleId,
      name,
      username,
      pin_hash: pinHash,
      all_outlets: allOutlets,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !user) {
    return { employee: null, error: "Gagal membuat karyawan" };
  }

  // Assign ke outlet (jika tidak all_outlets)
  if (!allOutlets && outletIds.length > 0) {
    const inserts = outletIds.map((outletId) => ({
      user_id: user.id,
      outlet_id: outletId,
    }));
    await supabase.from("user_outlets").insert(inserts);
  }

  return { employee: { id: user.id }, error: null };
}

export async function updateEmployee(params: {
  employeeId: string;
  companyId: string;
  name?: string;
  username?: string;
  roleId?: string;
  allOutlets?: boolean;
  outletIds?: string[];
}): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const { employeeId, companyId, name, username, roleId, allOutlets, outletIds } =
    params;

  // Cek username unik jika diubah
  if (username) {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("company_id", companyId)
      .eq("username", username)
      .neq("id", employeeId)
      .maybeSingle();

    if (existing) {
      return { error: "Username sudah dipakai" };
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (username !== undefined) updateData.username = username;
  if (roleId !== undefined) updateData.role_id = roleId;
  if (allOutlets !== undefined) updateData.all_outlets = allOutlets;

  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", employeeId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal mengupdate karyawan" };

  // Update outlet assignment jika diberikan
  if (outletIds !== undefined) {
    // Hapus assignment lama
    await supabase.from("user_outlets").delete().eq("user_id", employeeId);

    // Insert assignment baru
    if (outletIds.length > 0) {
      const inserts = outletIds.map((outletId) => ({
        user_id: employeeId,
        outlet_id: outletId,
      }));
      await supabase.from("user_outlets").insert(inserts);
    }
  }

  return { error: null };
}

export async function toggleEmployeeStatus(
  employeeId: string,
  companyId: string
): Promise<{ error: string | null; status: "active" | "inactive" | null }> {
  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("status")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!user) return { error: "Karyawan tidak ditemukan", status: null };

  const newStatus = user.status === "active" ? "inactive" : "active";

  const { error } = await supabase
    .from("users")
    .update({ status: newStatus })
    .eq("id", employeeId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal mengubah status", status: null };
  return { error: null, status: newStatus };
}

export async function resetEmployeePin(
  employeeId: string,
  companyId: string,
  newPin: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const pinHash = await hashPin(newPin);

  const { error } = await supabase
    .from("users")
    .update({
      pin_hash: pinHash,
      failed_pin_attempts: 0,
      locked_until: null,
    })
    .eq("id", employeeId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal reset PIN" };
  return { error: null };
}

export async function deleteEmployee(
  employeeId: string,
  companyId: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", employeeId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal menghapus karyawan" };
  return { error: null };
}

// ============================================================
// ROLES — untuk dropdown di form karyawan
// ============================================================
export async function getCompanyRoles(companyId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("roles")
    .select("id, name")
    .eq("company_id", companyId)
    .order("name");
  return data ?? [];
}

// ============================================================
// ROLES — CRUD untuk Owner (dengan akses menu)
// ============================================================
export async function createCompanyRole(
  companyId: string,
  name: string
): Promise<{ role: { id: string; name: string } | null; error: string | null }> {
  const supabase = createAdminClient();

  // Cek nama unik per company
  const { data: existing } = await supabase
    .from("roles")
    .select("id")
    .eq("company_id", companyId)
    .eq("name", name)
    .maybeSingle();

  if (existing) {
    return { role: null, error: "Nama role sudah dipakai" };
  }

  const { data: role, error } = await supabase
    .from("roles")
    .insert({ company_id: companyId, name })
    .select("id, name")
    .single();

  if (error || !role) {
    return { role: null, error: "Gagal membuat role" };
  }

  return { role, error: null };
}

export async function updateCompanyRole(
  roleId: string,
  companyId: string,
  name: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  // Cek nama unik jika diubah
  const { data: existing } = await supabase
    .from("roles")
    .select("id")
    .eq("company_id", companyId)
    .eq("name", name)
    .neq("id", roleId)
    .maybeSingle();

  if (existing) {
    return { error: "Nama role sudah dipakai" };
  }

  const { error } = await supabase
    .from("roles")
    .update({ name })
    .eq("id", roleId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal mengupdate role" };
  return { error: null };
}

export async function deleteCompanyRole(
  roleId: string,
  companyId: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  // Cek apakah role masih dipakai oleh user
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact" })
    .eq("role_id", roleId)
    .eq("company_id", companyId);

  if (count !== null && count > 0) {
    return {
      error: `Role tidak bisa dihapus karena masih dipakai oleh ${count} karyawan`,
    };
  }

  // Hapus role_menu_access terkait, lalu role-nya
  await supabase
    .from("role_menu_access")
    .delete()
    .eq("role_id", roleId);

  const { error } = await supabase
    .from("roles")
    .delete()
    .eq("id", roleId)
    .eq("company_id", companyId);

  if (error) return { error: "Gagal menghapus role" };
  return { error: null };
}

export async function getRoleMenuAccessIds(
  roleId: string
): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("role_menu_access")
    .select("menu_id")
    .eq("role_id", roleId)
    .eq("can_view", true);

  return (data ?? []).map((r) => r.menu_id as string);
}

export async function setCompanyRoleMenuAccess(
  roleId: string,
  menuId: string,
  canView: boolean
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  if (canView) {
    const { error } = await supabase
      .from("role_menu_access")
      .upsert(
        { role_id: roleId, menu_id: menuId, can_view: true },
        { onConflict: "role_id, menu_id" }
      );
    if (error) return { error: "Gagal mengaktifkan akses menu" };
  } else {
    const { error } = await supabase
      .from("role_menu_access")
      .delete()
      .eq("role_id", roleId)
      .eq("menu_id", menuId);
    if (error) return { error: "Gagal menonaktifkan akses menu" };
  }

  return { error: null };
}

export async function getAllSystemMenus() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("menus")
    .select("id, slug, name, icon, path, sort_order")
    .order("sort_order");

  return (data ?? []).map((m) => ({
    id: m.id as string,
    slug: m.slug as string,
    name: m.name as string,
    icon: m.icon as string | null,
    path: m.path as string,
    sort_order: m.sort_order as number,
  }));
}

export async function getRoleCompanyId(
  roleId: string
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("roles")
    .select("company_id")
    .eq("id", roleId)
    .maybeSingle();

  return (data?.company_id as string) ?? null;
}
