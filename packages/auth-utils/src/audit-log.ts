import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthEventType =
  | "company_login"
  | "outlet_select"
  | "account_select"
  | "pin_verify"
  | "shift_start"
  | "shift_end"
  | "switch_user";

interface LogAuthEventParams {
  company_id?: string | null;
  outlet_id?: string | null;
  user_id?: string | null;
  event_type: AuthEventType;
  success: boolean;
  ip_address?: string | null;
  user_agent?: string | null;
  failure_reason?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAuthEvent(
  supabase: SupabaseClient,
  params: LogAuthEventParams
): Promise<void> {
  try {
    await supabase.from("auth_audit_logs").insert({
      company_id: params.company_id,
      outlet_id: params.outlet_id,
      user_id: params.user_id,
      event_type: params.event_type,
      success: params.success,
      ip_address: params.ip_address,
      user_agent: params.user_agent,
      failure_reason: params.failure_reason,
      metadata: params.metadata || {},
    });
  } catch (error) {
    console.error("[AuditLog] Failed to log auth event:", error);
  }
}

export function getClientIp(): string {
  return "unknown";
}

export const FailureReasons = {
  COMPANY_NOT_FOUND: "company_not_found",
  WRONG_PASSWORD: "wrong_password",
  ACCOUNT_LOCKED: "account_locked",
  LOCKED_AFTER_MAX_ATTEMPTS: "locked_after_max_attempts",
  WRONG_PIN: "wrong_pin",
  PIN_LOCKED: "pin_locked",
  SESSION_EXPIRED: "session_expired",
  SESSION_INVALID: "session_invalid",
  USER_INACTIVE: "user_inactive",
  COMPANY_SUSPENDED: "company_suspended",
} as const;
