import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { OwnerSession } from "@/types";

const OWNER_COOKIE = "owner_session";
const OWNER_DURATION = 24 * 60 * 60; // 24 jam
const SECRET = new TextEncoder().encode(
  process.env.TENANT_JWT_SECRET || "dev-secret-change-in-production-min-32-chars!!"
);

interface OwnerPayload extends JWTPayload {
  owner_id: string;
  email: string;
  name: string;
  company_id: string | null;
  company_name: string | null;
  company_slug: string | null;
}

export async function signOwnerSession(session: OwnerSession): Promise<string> {
  return new SignJWT({ ...session } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${OWNER_DURATION}s`)
    .sign(SECRET);
}

export async function verifyOwnerSession(token: string): Promise<OwnerSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const p = payload as OwnerPayload;
    return {
      owner_id: p.owner_id,
      email: p.email,
      name: p.name,
      company_id: p.company_id ?? null,
      company_name: p.company_name ?? null,
      company_slug: p.company_slug ?? null,
    };
  } catch {
    return null;
  }
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

export function setOwnerSessionCookie(token: string) {
  return `${OWNER_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${OWNER_DURATION}`;
}

export const OWNER_COOKIE_NAME = OWNER_COOKIE;
export const OWNER_SESSION_DURATION = OWNER_DURATION;
