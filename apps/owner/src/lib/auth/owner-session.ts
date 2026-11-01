import { verifyOwnerSession, OWNER_SESSION_DURATION, OWNER_REMEMBER_DURATION_SECONDS } from "./session-token";
import { signOwnerSession as signToken } from "./session-token";
export { verifyOwnerSession, OWNER_SESSION_DURATION, OWNER_REMEMBER_DURATION_SECONDS } from "./session-token";
import { issueSession } from "@rakku/db/sessions";
import { cookies } from "next/headers";
import type { OwnerSession } from "@rakku/shared-types";
import { createAdminClient } from "@rakku/db";
import { readActiveOwnerContext } from "@rakku/db/owner-session";
import { cache } from "react";

type OwnerContext = OwnerSession & { phone: string | null; company_code: string | null };

const OWNER_COOKIE = "owner_session";
export async function signOwnerSession(session: OwnerSession, remember = false) {
  const session_id = await issueSession(createAdminClient(), "owner", session.owner_id,
    remember ? OWNER_REMEMBER_DURATION_SECONDS : OWNER_SESSION_DURATION);
  return signToken({ ...session, session_id }, remember);
}
// React memoizes only within a server render. No authorization survives a request.
export const getOwnerSessionFromCookies = cache(async (): Promise<OwnerContext | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(OWNER_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyOwnerSession(token);
  if (!session) return null;
  const context = await readActiveOwnerContext(createAdminClient(), { ownerId: session.owner_id, sessionId: session.session_id });
  if (!context) return null;
  return { ...session, ...context };
});

export function clearOwnerSessionCookie() {
  return `${OWNER_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function setOwnerSessionCookie(token: string, remember: boolean = false) {
  const duration = remember ? OWNER_REMEMBER_DURATION_SECONDS : OWNER_SESSION_DURATION;
  return `${OWNER_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${duration}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export const OWNER_COOKIE_NAME = OWNER_COOKIE;
