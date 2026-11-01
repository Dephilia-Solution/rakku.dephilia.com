import { redirect } from "next/navigation";
import { getTenantSessionFromCookies } from "./tenant-session";
import { getPendingLoginFromCookies } from "./pending-login";
import { getAccountsForOutlet } from "./company";
import { getTenantHome } from "./menus";
export async function requireLoginStage(stage: "company" | "outlet" | "user" | "pin", userId?: string) {
  const session = await getTenantSessionFromCookies();
  if (session) redirect(await getTenantHome(session.role_id));
  const pending = await getPendingLoginFromCookies();
  if (!pending) { if (stage !== "company") redirect("/login"); return; }
  const destination = pending.outlet_id ? "/login/select-user" : "/login/select-outlet";
  if (stage === "company") redirect(destination);
  if ((stage === "user" || stage === "pin") && !pending.outlet_id) redirect(destination);
  if (stage === "pin") {
    const accounts = await getAccountsForOutlet(pending.outlet_id!, pending.company_id);
    if (!accounts.some(account => account.id === userId)) redirect("/login/select-user");
  }
}
