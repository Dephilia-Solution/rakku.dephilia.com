import { signJwt, verifyJwt } from "@rakku/auth-utils";
import { cookies } from "next/headers";
import type { TenantSession } from "@rakku/shared-types";

const SESSION_COOKIE = "session";
const SECRET = new TextEncoder().encode(
  process.env.POS_JWT_SECRET || "dev-secret-change-in-production-min-32-chars!!"
);

export async function signSession(session: TenantSession): Promise<string> {
  return signJwt(SECRET, { ...session });
}

export async function verifySession(token: string): Promise<TenantSession | null> {
  const payload = await verifyJwt<TenantSession>(SECRET, token);
  if (!payload) return null;

  return {
    user_id: payload.user_id,
    company_id: payload.company_id,
    outlet_id: payload.outlet_id,
    role_id: payload.role_id,
    user_name: payload.user_name,
    company_name: payload.company_name,
    outlet_name: payload.outlet_name,
  };
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
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax`;
}
