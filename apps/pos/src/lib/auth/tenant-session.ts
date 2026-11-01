import { verifySession } from "./session-token";
import { signSession as signToken } from "./session-token";
export { verifySession } from "./session-token";
import { issueSession, isSessionActive } from "@rakku/db/sessions";
import { cookies } from "next/headers";
import type { TenantSession } from "@rakku/shared-types";
import { createAdminClient, type DatabaseClient } from "@rakku/db";
import { cache } from "react";

const SESSION_COOKIE = "session";
export async function signSession(session: TenantSession, db: DatabaseClient = createAdminClient()) {
  const session_id = await issueSession(db, "pos", session.user_id, 43200);
  return signToken({ ...session, session_id });
}
// Deduplicate the layout/helper/client checks during one render, never across users.
export const getTenantSessionFromCookies = cache(async (): Promise<TenantSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const db = createAdminClient();
  if (!await isSessionActive(db, session.session_id, "pos", session.user_id)) return null;
  const [userResult, companyResult, outletResult] = await Promise.all([
    db.from("users").select("id, role_id, all_outlets").eq("id", session.user_id).eq("company_id", session.company_id).eq("status", "active").maybeSingle(),
    db.from("companies").select("id").eq("id", session.company_id).eq("status", "active").maybeSingle(),
    db.from("outlets").select("id").eq("id", session.outlet_id).eq("company_id", session.company_id).eq("status", "active").maybeSingle(),
  ]);
  if (userResult.error || companyResult.error || outletResult.error) throw new Error("POS authentication lookup failed");
  const user = userResult.data, company = companyResult.data, outlet = outletResult.data;
  if (!user || !company || !outlet || user.role_id !== session.role_id) return null;
  if (!user.all_outlets) {
    const { data: access, error } = await db.from("user_outlets").select("user_id").eq("user_id", session.user_id).eq("outlet_id", session.outlet_id).maybeSingle();
    if (error) throw new Error("POS assignment lookup failed");
    if (!access) return null;
  }
  return session;
});

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function setSessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
