import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets } from "@/lib/supabase/queries.owner";
import { redirect } from "next/navigation";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    redirect("/login");
  }

  const outlets = await getOwnerOutlets(session.company_id);

  return (
    <ReportsClient
      outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
      companyName={session.company_name ?? "Perusahaan"}
    />
  );
}
