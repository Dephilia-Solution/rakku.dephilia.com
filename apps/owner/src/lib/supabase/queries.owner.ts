import { revokeSubjectSessions } from "@rakku/db/sessions";
import { saveEmployee } from "@rakku/db/merchant";
import { deleteRole, getRoleGrants, saveRoleGrants, onboardingRoleGrants } from "@rakku/db/roles-access";
import bcrypt from "bcryptjs";
import { createAdminClient, sql } from "@rakku/db";
import { readOwnerOutletStats } from "@rakku/db/owner-dashboard";
import { cache } from "react";
import { hashPin } from "@rakku/auth-utils";
import { isValidCompanyCode, normalizeCompanyCode } from "@/lib/company-code";
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
  try {
    await supabase.transaction(async tx => {
      const result = await tx.from("owners").update({ password_hash: passwordHash, reset_token_hash: null, reset_token_expires_at: null }).eq("id", ownerId).select("id").single();
      if (result.error) throw new Error(result.error.message);
      await revokeSubjectSessions(tx, "owner", ownerId);
    });
    return { error: null };
  } catch { return { error: "Gagal memperbarui kata sandi" }; }
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

export async function checkCompanyCodeAvailability(
  value: string,
): Promise<{ available: boolean; error: string | null }> {
  const code = normalizeCompanyCode(value);
  if (!isValidCompanyCode(code)) {
    return { available: false, error: "Kode perusahaan hanya boleh berisi huruf dan angka (1–32 karakter)." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  if (error) return { available: false, error: "Ketersediaan kode perusahaan belum dapat diperiksa." };
  return { available: !data, error: null };
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
  const { ownerId, companyName, companyPassword, outletName, outletAddress } = params;
  const code = normalizeCompanyCode(params.companyCode);
  if (!isValidCompanyCode(code)) {
    return { company: null, error: "Kode perusahaan hanya boleh berisi huruf dan angka (1–32 karakter)." };
  }
  const passwordHash = await bcrypt.hash(companyPassword, 10);
  return supabase.transaction(async supabase => {
  const owners = await supabase.execute(sql`select id from public.owners where id=${ownerId} and is_active=true for update`);
  if (!owners.length) throw new Error("Owner tidak aktif");

  // Cek owner belum punya company
  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (existingCompany) {
    return { company: null, error: "Anda sudah memiliki perusahaan" };
  }

  const { data: existingCode, error: codeCheckError } = await supabase
    .from("companies")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (codeCheckError) throw new Error("Ketersediaan kode perusahaan belum dapat diperiksa.");
  if (existingCode) return { company: null, error: "Kode perusahaan sudah digunakan. Silakan pilih kode lain." };

  // Generate unique slug
  const baseSlug = generateSlug(companyName);
  const slug = await ensureUniqueSlug(baseSlug);

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
    if (companyError?.code === "23505" && /code/i.test(`${companyError.message} ${companyError.details ?? ""}`)) {
      throw new Error("Kode perusahaan sudah digunakan. Silakan pilih kode lain.");
    }
    throw new Error("Gagal membuat perusahaan");
  }

  // 2. Buat outlet pertama
  const { error: outletError } = await supabase.from("outlets").insert({
    company_id: company.id,
    name: outletName,
    address: outletAddress || null,
    status: "active",
  });

  if (outletError) {
    throw new Error("Gagal membuat outlet");
  }

  // 3. Seed default pricing tiers (Dine In & Take Away)
  const { data: outlet } = await supabase
    .from("outlets")
    .select("id")
    .eq("company_id", company.id)
    .eq("name", outletName)
    .maybeSingle();

  if (outlet) {
    const tiers = await supabase.from("pricing_tiers").insert([
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
    if (tiers.error) throw new Error(tiers.error.message);
  }

  // 4. Seed role default (paket Free = role tetap): Owner (semua menu) + Kasir.
  //    Role custom tambahan hanya untuk paket Pro/Business (v6).
  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .insert([
      { company_id: company.id, name: "Owner" },
      { company_id: company.id, name: "Kasir" },
    ])
    .select("id, name");
  if (rolesError || !roles) throw new Error("Gagal membuat role");

  const { data: menus, error: menusError } = await supabase.from("menus").select("id, slug");
  if (menusError || !menus) throw new Error("Gagal memuat menu");
  // These IDs were just created above. No name-based backfill of old roles.
  for (const kind of ["owner", "kasir"] as const) {
    const role = roles.find(r => r.name === (kind === "owner" ? "Owner" : "Kasir"));
    if (!role) throw new Error("Role onboarding tidak ditemukan");
    const current = await getRoleGrants(supabase, company.id, role.id);
    await saveRoleGrants(supabase, {
      companyId: company.id, roleId: role.id, expectedRevision: current.revision,
      grants: onboardingRoleGrants(kind, menus), actor: { kind: "owner", id: ownerId },
    });
  }

  // 5. Trial Pro 14 hari (v6 M2). Setelah habis, resolusi plan otomatis
  //    turun ke Free tanpa menghapus data.
  const { data: proPlan } = await supabase
    .from("plans")
    .select("id")
    .eq("slug", "pro")
    .maybeSingle();

  if (proPlan) {
    const trial = await supabase
      .from("companies")
      .update({
        plan_id: proPlan.id,
        subscription_status: "trial",
        trial_ends_at: new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000
        ).toISOString(),
      })
      .eq("id", company.id);
    if (trial.error) throw new Error(trial.error.message);
  }

  return {
    company: { id: company.id, name: company.name, slug, code },
    error: null,
  };
  }).catch(error => ({ company: null, error: error instanceof Error ? error.message : "Gagal onboarding" }));
}

// ============================================================
// OUTLETS — CRUD untuk Owner
// ============================================================
export const getOwnerOutlets = cache(async (
  companyId: string
): Promise<OwnerDashboardOutlet[]> => readOwnerOutletStats(createAdminClient(), companyId));

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
  try {
    const employee = await saveEmployee(createAdminClient(), { ...params, pinHash: await hashPin(params.pin) });
    return { employee, error: null };
  } catch (error) { return { employee: null, error: error instanceof Error ? error.message : "Gagal membuat karyawan" }; }
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
  try {
    await saveEmployee(createAdminClient(), params);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "Gagal mengupdate karyawan" }; }
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

  try {
    await supabase.transaction(async tx => {
      const result = await tx.from("users").update({ pin_hash: pinHash, failed_pin_attempts: 0, locked_until: null })
        .eq("id", employeeId).eq("company_id", companyId).select("id").single();
      if (result.error) throw new Error(result.error.message);
      await revokeSubjectSessions(tx, "pos", employeeId);
    });
    return { error: null };
  } catch { return { error: "Gagal reset PIN" }; }
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
  const { data, error } = await supabase
    .from("roles")
    .select("id, name")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw new Error("Gagal memuat role");
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

  const { data: updated, error } = await supabase
    .from("roles")
    .update({ name })
    .eq("id", roleId)
    .eq("company_id", companyId)
    .select("id").single();

  if (error || !updated) return { error: "Gagal mengupdate role" };
  return { error: null };
}

export async function deleteCompanyRole(
  roleId: string,
  companyId: string
): Promise<{ error: string | null }> {
  await deleteRole(createAdminClient(), companyId, roleId);
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
