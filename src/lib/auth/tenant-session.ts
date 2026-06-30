import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { TenantSession } from "@/types";

const SESSION_COOKIE = "session";
const SESSION_DURATION = 12 * 60 * 60;  // 12 hours absolute expiration
const IDLE_TIMEOUT = 30 * 60;            // 30 minutes idle timeout
const SECRET = new TextEncoder().encode(
  process.env.TENANT_JWT_SECRET || "dev-secret-change-in-production-min-32-chars!!"
);

interface SessionPayload extends JWTPayload {
  user_id: string;
  company_id: string;
  outlet_id: string;
  role_id: string;
  user_name: string;
  company_name: string;
  outlet_name: string;
  last_activity?: number;  // Unix timestamp in seconds
}

export function getSessionConfig() {
  return {
    sessionDuration: SESSION_DURATION,
    idleTimeout: IDLE_TIMEOUT,
  };
}

export async function signSession(session: TenantSession): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    ...session,
    last_activity: now,
  } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<TenantSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const p = payload as SessionPayload;

    // Check idle timeout
    if (p.last_activity) {
      const now = Math.floor(Date.now() / 1000);
      const idleSeconds = now - p.last_activity;
      if (idleSeconds > IDLE_TIMEOUT) {
        // Session expired due to inactivity
        return null;
      }
    }

    return {
      user_id: p.user_id,
      company_id: p.company_id,
      outlet_id: p.outlet_id,
      role_id: p.role_id,
      user_name: p.user_name,
      company_name: p.company_name,
      outlet_name: p.outlet_name,
    };
  } catch {
    return null;
  }
}

/**
 * Refreshes the session by updating the last_activity timestamp.
 * Returns a new token with updated activity, or null if session is invalid.
 */
export async function refreshSessionActivity(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const p = payload as SessionPayload;

    // Check if session is still valid (not expired by idle timeout)
    const now = Math.floor(Date.now() / 1000);
    if (p.last_activity) {
      const idleSeconds = now - p.last_activity;
      if (idleSeconds > IDLE_TIMEOUT) {
        // Session already expired due to inactivity
        return null;
      }
    }

    // Create new token with updated last_activity
    const updatedSession: TenantSession = {
      user_id: p.user_id,
      company_id: p.company_id,
      outlet_id: p.outlet_id,
      role_id: p.role_id,
      user_name: p.user_name,
      company_name: p.company_name,
      outlet_name: p.outlet_name,
    };

    return await signSession(updatedSession);
  } catch {
    return null;
  }
}

export async function getTenantSessionFromCookies(): Promise<TenantSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function setSessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION}`;
}
