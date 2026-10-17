import { redirect } from "next/navigation";
import { getAuthorizedUser } from "@/lib/auth/require-superadmin";

export default async function SuperadminRoot() {
  if (!await getAuthorizedUser()) {
    redirect("/login");
  }

  redirect("/companies");
}
