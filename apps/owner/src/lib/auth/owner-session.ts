import { verifyOwnerSession, OWNER_SESSION_DURATION, OWNER_REMEMBER_DURATION_SECONDS } from "./session-token";
import { signOwnerSession as signToken } from "./session-token";
export { verifyOwnerSession, OWNER_SESSION_DURATION, OWNER_REMEMBER_DURATION_SECONDS } from "./session-token";
import { issueSession, isSessionActive } from "@rakku/db/sessions";
import { cookies } from "next/headers";
import type { OwnerSession } from "@rakku/shared-types";
import { createAdminClient } from "@rakku/db";

const OWNER_COOKIE = "owner_session";
export async function signOwnerSession(session: OwnerSession, remember = false) {
  const session_id = await issueSession(createAdminClient(), "owner", session.owner_id,
    remember ? OWNER_REMEMBER_DURATION_SECONDS : OWNER_SESSION_DURATION);
  return signToken({ ...session, session_id }, remember);
}
export async function getOwnerSessionFromCookies(): Promise<OwnerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(OWNER_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyOwnerSession(token);
  if (!session) return null;
  const db = createAdminClient();
  if (!await isSessionActive(db, session.session_id, "owner", session.owner_id)) return null;
  const { data: owner, error: ownerError } = await db.from("owners").select("id, email, name, email_verified_at").eq("id", session.owner_id).eq("is_active", true).maybeSingle();
  if (ownerError) throw new Error("Owner authentication lookup failed");
  if (!owner?.email_verified_at) return null;
  const { data: company, error: companyError } = await db.from("companies").select("id, name, slug, status").eq("owner_id", owner.id).maybeSingle();
  if (companyError) throw new Error("Owner company lookup failed");
  if (company && company.status !== "active") return null;
  return { ...session, email: owner.email, name: owner.name, company_id: company?.id ?? null,
    company_name: company?.name ?? null, company_slug: company?.slug ?? null };
}

export function clearOwnerSessionCookie() {
  return `${OWNER_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function setOwnerSessionCookie(token: string, remember: boolean = false) {
  const duration = remember ? OWNER_REMEMBER_DURATION_SECONDS : OWNER_SESSION_DURATION;
  return `${OWNER_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${duration}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export const OWNER_COOKIE_NAME = OWNER_COOKIE;
