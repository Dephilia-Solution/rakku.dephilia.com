import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Authentication event types that can be logged
 */
export type AuthEventType =
  | "company_login"
  | "outlet_select"
  | "account_select"
  | "pin_verify"
  | "session_created"
  | "logout";

/**
 * Parameters for logging an authentication event
 */
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

/**
 * Logs an authentication event to the auth_audit_logs table.
 *
 * This function is designed to never throw errors - if logging fails,
 * it will only log to console and not interrupt the authentication flow.
 *
 * @param params - The event parameters to log
 */
export async function logAuthEvent(params: LogAuthEventParams): Promise<void> {
  const supabase = createAdminClient();

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
    // Log errors but don't throw - audit logging shouldn't break auth flow
    console.error("[AuditLog] Failed to log auth event:", error);
  }
}

/**
 * Extracts the client IP address from a NextRequest.
 * Checks various headers that might contain the real IP.
 *
 * @param request - The NextRequest object
 * @returns The client IP address or "unknown"
 */
export function getClientIp(): string {
  // Note: In Next.js server components/API routes, we need to handle headers differently
  // This is a placeholder - the actual implementation will be in the route handlers
  return "unknown";
}

/**
 * Common failure reasons for documentation
 */
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
