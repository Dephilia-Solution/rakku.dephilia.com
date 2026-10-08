import { verifySession } from "./session-token";
export { signSession, verifySession } from "./session-token";
import { cookies } from "next/headers";
import type { TenantSession } from "@rakku/shared-types";
import { createAdminClient } from "@rakku/db";

const SESSION_COOKIE = "session";
export async function getTenantSessionFromCookies(): Promise<TenantSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const db = createAdminClient();
  const [{ data: user }, { data: company }, { data: outlet }] = await Promise.all([
    db.from("users").select("id, role_id, all_outlets").eq("id", session.user_id).eq("company_id", session.company_id).eq("status", "active").maybeSingle(),
    db.from("companies").select("id").eq("id", session.company_id).eq("status", "active").maybeSingle(),
    db.from("outlets").select("id").eq("id", session.outlet_id).eq("company_id", session.company_id).eq("status", "active").maybeSingle(),
  ]);
  if (!user || !company || !outlet || user.role_id !== session.role_id) return null;
  if (!user.all_outlets) {
    const { data: access } = await db.from("user_outlets").select("user_id").eq("user_id", session.user_id).eq("outlet_id", session.outlet_id).maybeSingle();
    if (!access) return null;
  }
  return session;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function setSessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
