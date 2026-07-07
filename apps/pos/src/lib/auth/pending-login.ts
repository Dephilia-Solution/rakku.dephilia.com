import { signJwt, verifyJwt } from "@rakku/auth-utils";
import { cookies } from "next/headers";
import type { PendingLogin } from "@rakku/shared-types";

const PENDING_COOKIE = "pending_login";
const PENDING_DURATION = 10 * 60;
const SECRET = new TextEncoder().encode(
  process.env.POS_JWT_SECRET || "dev-secret-change-in-production-min-32-chars!!"
);

export async function signPendingLogin(data: PendingLogin): Promise<string> {
  return signJwt(SECRET, { ...data }, PENDING_DURATION);
}

export async function verifyPendingLogin(token: string): Promise<PendingLogin | null> {
  const payload = await verifyJwt<PendingLogin>(SECRET, token);
  if (!payload) return null;
  return {
    company_id: payload.company_id,
    company_name: payload.company_name,
    outlet_id: payload.outlet_id,
    outlet_name: payload.outlet_name,
  };
}

export async function getPendingLoginFromCookies(): Promise<PendingLogin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_COOKIE)?.value;
  if (!token) return null;
  return verifyPendingLogin(token);
}

export function clearPendingLoginCookie() {
  return `${PENDING_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function setPendingLoginCookie(token: string) {
  return `${PENDING_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${PENDING_DURATION}`;
}
