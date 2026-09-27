import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";

export default async function DashboardRoot() {
  const session = await getOwnerSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  if (!session.company_id) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
