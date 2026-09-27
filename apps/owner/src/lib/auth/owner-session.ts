import { signJwt, verifyJwt } from "@rakku/auth-utils";
import { cookies } from "next/headers";
import type { OwnerSession } from "@rakku/shared-types";

const OWNER_COOKIE = "owner_session";
const OWNER_DURATION = 24 * 60 * 60;
const OWNER_REMEMBER_DURATION = 30 * 24 * 60 * 60;
const SECRET = new TextEncoder().encode(
  process.env.OWNER_JWT_SECRET || "dev-secret-change-in-production-min-32-chars!!"
);

export async function signOwnerSession(
  session: OwnerSession,
  remember: boolean = false
): Promise<string> {
  const duration = remember ? OWNER_REMEMBER_DURATION : OWNER_DURATION;
  return signJwt(SECRET, { ...session }, duration);
}

export async function verifyOwnerSession(token: string): Promise<OwnerSession | null> {
  const payload = await verifyJwt<OwnerSession>(SECRET, token);
  if (!payload) return null;

  return {
    owner_id: payload.owner_id,
    email: payload.email,
    name: payload.name,
    company_id: payload.company_id ?? null,
    company_name: payload.company_name ?? null,
    company_slug: payload.company_slug ?? null,
  };
}

export async function getOwnerSessionFromCookies(): Promise<OwnerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(OWNER_COOKIE)?.value;
  if (!token) return null;
  return verifyOwnerSession(token);
}

export function clearOwnerSessionCookie() {
  return `${OWNER_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function setOwnerSessionCookie(token: string, remember: boolean = false) {
  const duration = remember ? OWNER_REMEMBER_DURATION : OWNER_DURATION;
  return `${OWNER_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${duration}`;
}

export const OWNER_COOKIE_NAME = OWNER_COOKIE;
export const OWNER_SESSION_DURATION = OWNER_DURATION;
export const OWNER_REMEMBER_DURATION_SECONDS = OWNER_REMEMBER_DURATION;
