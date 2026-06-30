import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuthEvent, type AuthEventType } from "./audit-log";

// ============================================================
// Company Login Rate Limiting Configuration
// ============================================================

const COMPANY_MAX_ATTEMPTS = 10;
const COMPANY_LOCKOUT_MINUTES = 15;

/**
 * Checks if a company login is currently locked
 */
export function isCompanyLoginLocked(lockedUntil: string | null): boolean {
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
}

/**
 * Computes the timestamp for when the lockout should expire
 */
export function computeCompanyLockoutUntil(): Date {
  return new Date(Date.now() + COMPANY_LOCKOUT_MINUTES * 60 * 1000);
}

/**
 * Returns the rate limiting configuration
 */
export function getCompanyLockoutConfig() {
  return {
    maxAttempts: COMPANY_MAX_ATTEMPTS,
    lockoutMinutes: COMPANY_LOCKOUT_MINUTES,
  };
}

// ============================================================
// Company Login Verification with Rate Limiting
// ============================================================

export async function verifyCompanyLogin(
  code: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
) {
  const supabase = createAdminClient();

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("code", code)
    .eq("status", "active")
    .single();

  // Company not found
  if (!company) {
    await logAuthEvent({
      company_id: null,
      outlet_id: null,
      user_id: null,
      event_type: "company_login" as AuthEventType,
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: "company_not_found",
      metadata: { code },
    });
    return { company: null, error: "Perusahaan tidak ditemukan" };
  }

  // Check if company login is locked
  if (isCompanyLoginLocked(company.login_locked_until)) {
    const lockExpiry = new Date(company.login_locked_until).toLocaleTimeString(
      "id-ID",
      { hour: "2-digit", minute: "2-digit" }
    );
    await logAuthEvent({
      company_id: company.id,
      outlet_id: null,
      user_id: null,
      event_type: "company_login" as AuthEventType,
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: "account_locked",
      metadata: { locked_until: company.login_locked_until },
    });
    return {
      company: null,
      error: `Login terkunci hingga ${lockExpiry}`,
    };
  }

  const valid = await bcrypt.compare(password, company.password_hash);

  // Failed password
  if (!valid) {
    const newAttempts = (company.failed_login_attempts || 0) + 1;
    const { maxAttempts } = getCompanyLockoutConfig();

    // Check if should lock
    if (newAttempts >= maxAttempts) {
      const lockedUntil = computeCompanyLockoutUntil();
      await supabase
        .from("companies")
        .update({
          failed_login_attempts: newAttempts,
          login_locked_until: lockedUntil.toISOString(),
          last_login_attempt: new Date().toISOString(),
        })
        .eq("id", company.id);

      await logAuthEvent({
        company_id: company.id,
        outlet_id: null,
        user_id: null,
        event_type: "company_login" as AuthEventType,
        success: false,
        ip_address: ipAddress,
        user_agent: userAgent,
        failure_reason: "locked_after_max_attempts",
        metadata: {
          attempts: newAttempts,
          locked_until: lockedUntil.toISOString(),
        },
      });

      return {
        company: null,
        error: `Login terkunci ${COMPANY_LOCKOUT_MINUTES} menit karena ${maxAttempts} kali percobaan gagal`,
      };
    }

    // Update attempts but don't lock yet
    await supabase
      .from("companies")
      .update({
        failed_login_attempts: newAttempts,
        last_login_attempt: new Date().toISOString(),
      })
      .eq("id", company.id);

    const remaining = maxAttempts - newAttempts;
    await logAuthEvent({
      company_id: company.id,
      outlet_id: null,
      user_id: null,
      event_type: "company_login" as AuthEventType,
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: "wrong_password",
      metadata: { attempts: newAttempts, remaining_attempts: remaining },
    });

    return {
      company: null,
      error: `Password salah. Sisa percobaan: ${remaining}`,
    };
  }

  // Successful login - reset attempts
  await supabase
    .from("companies")
    .update({
      failed_login_attempts: 0,
      login_locked_until: null,
      last_login_attempt: null,
    })
    .eq("id", company.id);

  await logAuthEvent({
    company_id: company.id,
    outlet_id: null,
    user_id: null,
    event_type: "company_login" as AuthEventType,
    success: true,
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: {},
  });

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
