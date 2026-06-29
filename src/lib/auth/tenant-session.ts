import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { TenantSession } from "@/types";

const SESSION_COOKIE = "session";
const SESSION_DURATION = 12 * 60 * 60;
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
}

export async function signSession(session: TenantSession): Promise<string> {
  return new SignJWT({ ...session } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<TenantSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const p = payload as SessionPayload;
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
