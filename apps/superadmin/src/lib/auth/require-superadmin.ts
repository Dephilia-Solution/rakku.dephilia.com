import "server-only";
import { sql, createAdminClient } from "@rakku/db";
import { getAuth } from "./server";
import { headers } from "next/headers";
import { isAllowedSuperadminOrigin } from "./origins";

export async function getAuthorizedUser() {
  const { data: session, error } = await getAuth().getSession();
  if (error || !session?.user) return null;
  const user = session.user;
  const rows = await createAdminClient().execute(sql`select auth_subject from app_private.superadmins
    where auth_subject = ${user.id} and status = 'active' and role = 'superadmin'`);
  return rows.length ? user : null;
}

export async function requireSuperadmin() {
  const origin = (await headers()).get("origin");
  if (!isAllowedSuperadminOrigin(origin)) throw new Error("Unauthorized");
  const user = await getAuthorizedUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
