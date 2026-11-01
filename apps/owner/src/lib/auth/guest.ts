import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "./owner-session";
export async function requireOwnerGuest() {
  const session = await getOwnerSessionFromCookies();
  if (session) redirect(session.company_id ? "/" : "/onboarding");
}
