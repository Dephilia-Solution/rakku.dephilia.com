import { signJwt, verifyJwt } from "@rakku/auth-utils";
import { cookies } from "next/headers";
import type { PendingLogin } from "@rakku/shared-types";
import { createAdminClient, type DatabaseClient } from "@rakku/db";
import { issueSession, isSessionActive } from "@rakku/db/sessions";

const PENDING_COOKIE = "pending_login";
const PENDING_DURATION = 10 * 60;
function secret() {
  const value = process.env.POS_JWT_SECRET;
  if (!value || value.length < 32) throw new Error("POS_JWT_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}

export async function signPendingLogin(data: PendingLogin, expiresInSeconds: number = PENDING_DURATION, db: DatabaseClient = createAdminClient()): Promise<string> {
  const session_id = await issueSession(db, "pending", data.company_id, expiresInSeconds);
  return signJwt(secret(), { ...data, session_id }, expiresInSeconds, "pos_pending");
}

export async function verifyPendingLogin(token: string): Promise<PendingLogin | null> {
  const payload = await verifyJwt<PendingLogin>(secret(), token, "pos_pending");
  if (!payload || typeof payload.company_id !== "string" || typeof payload.session_id !== "string") return null;
  const db = createAdminClient();
  if (!await isSessionActive(db, payload.session_id, "pending", payload.company_id)) return null;
  const { data: company, error: companyError } = await db.from("companies").select("id").eq("id", payload.company_id).eq("status", "active").maybeSingle();
  if (companyError) throw new Error("Pending company lookup failed");
  if (!company) return null;
  if (payload.outlet_id) {
    const { data: outlet, error } = await db.from("outlets").select("id").eq("id", payload.outlet_id).eq("company_id", payload.company_id).eq("status", "active").maybeSingle();
    if (error) throw new Error("Pending outlet lookup failed");
    if (!outlet) return null;
  }
  return {
    session_id: payload.session_id,
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

export function setPendingLoginCookie(token: string, maxAgeSeconds: number = PENDING_DURATION) {
  if (maxAgeSeconds > 0) {
    return `${PENDING_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  }
  throw new Error("Pending cookie must expire");
}
