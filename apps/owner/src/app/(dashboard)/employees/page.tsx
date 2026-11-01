import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";

export const dynamic = "force-dynamic";

export default async function OwnerEmployeesRedirectPage() {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    redirect("/login");
  }
  redirect("/outlets?tab=tim");
}
