import { createAdminClient } from "@rakku/supabase-clients";
import bcrypt from "bcryptjs";
import { signPendingLogin } from "./pending-login";
import { logAuthEvent, FailureReasons, computeLockedUntil, getRemainingAttempts } from "@rakku/auth-utils";
import type { Company, Outlet, User } from "@rakku/shared-types";

const COMPANY_MAX_ATTEMPTS = 10;

export async function verifyCompanyLogin(
  code: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ company: Company; pendingLoginToken: string } | { error: string; status: number }> {
  const supabase = createAdminClient();

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!company) {
    await logAuthEvent(supabase, {
      event_type: "company_login",
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: FailureReasons.COMPANY_NOT_FOUND,
      metadata: { code },
    });
    return { error: "Kode perusahaan tidak ditemukan.", status: 401 };
  }

  if (company.status === "suspended") {
    await logAuthEvent(supabase, {
      company_id: company.id,
      event_type: "company_login",
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: FailureReasons.COMPANY_SUSPENDED,
    });
    return { error: "Akun perusahaan ditangguhkan.", status: 403 };
  }

  if (company.login_locked_until && new Date(company.login_locked_until) > new Date()) {
    await logAuthEvent(supabase, {
      company_id: company.id,
      event_type: "company_login",
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: FailureReasons.ACCOUNT_LOCKED,
    });
    return { error: "Akun terkunci. Coba lagi beberapa menit.", status: 423 };
  }

  const valid = await bcrypt.compare(password, company.password_hash);
  if (!valid) {
    const failedAttempts = (company.failed_login_attempts || 0) + 1;
    const locked = failedAttempts >= COMPANY_MAX_ATTEMPTS;
    const lockedUntil = locked ? computeLockedUntil() : null;

    await supabase
      .from("companies")
      .update({
        failed_login_attempts: failedAttempts,
        login_locked_until: lockedUntil?.toISOString() ?? null,
        last_login_attempt: new Date().toISOString(),
      })
      .eq("id", company.id);

    await logAuthEvent(supabase, {
      company_id: company.id,
      event_type: "company_login",
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: FailureReasons.WRONG_PASSWORD,
    });

    const remaining = getRemainingAttempts(failedAttempts);
    return {
      error: `Password salah. Sisa percobaan: ${remaining}`,
      status: 401,
    };
  }

  if (company.failed_login_attempts > 0) {
    await supabase
      .from("companies")
      .update({ failed_login_attempts: 0, login_locked_until: null, last_login_attempt: new Date().toISOString() })
      .eq("id", company.id);
  }

  await logAuthEvent(supabase, {
    company_id: company.id,
    event_type: "company_login",
    success: true,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  const pendingLoginToken = await signPendingLogin({
    company_id: company.id,
    company_name: company.name,
  });

  return { company, pendingLoginToken };
}

export async function getActiveOutlets(companyId: string): Promise<Outlet[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("outlets")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("name");

  return data || [];
}

export async function getAccountsForOutlet(
  outletId: string,
  companyId: string
): Promise<User[]> {
  const supabase = createAdminClient();
  const { data: userOutlets } = await supabase
    .from("user_outlets")
    .select("user_id")
    .eq("outlet_id", outletId);

  const userIds = (userOutlets || []).map((uo: { user_id: string }) => uo.user_id);

  let query = supabase
    .from("users")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("name");

  if (userIds.length > 0) {
    query = query.or(`all_outlets.eq.true,id.in.(${userIds.join(",")})`);
  } else {
    query = query.eq("all_outlets", true);
  }

  const { data } = await query;
  return data || [];
}
