import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { PendingLogin } from "@/types";

const PENDING_COOKIE = "pending_login";
const PENDING_DURATION = 10 * 60;
const SECRET = new TextEncoder().encode(
  process.env.TENANT_JWT_SECRET || "dev-secret-change-in-production-min-32-chars!!"
);

interface PendingPayload extends JWTPayload {
  company_id: string;
  company_name?: string;
  outlet_id?: string;
  outlet_name?: string;
}

export async function signPendingLogin(data: PendingLogin): Promise<string> {
  return new SignJWT({ ...data } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_DURATION}s`)
    .sign(SECRET);
}

export async function verifyPendingLogin(token: string): Promise<PendingLogin | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const p = payload as PendingPayload;
    return {
      company_id: p.company_id,
      company_name: p.company_name,
      outlet_id: p.outlet_id,
      outlet_name: p.outlet_name,
    };
  } catch {
    return null;
  }
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
