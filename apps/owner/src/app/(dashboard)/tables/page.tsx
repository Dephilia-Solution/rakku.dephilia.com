import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets } from "@/lib/supabase/queries.owner";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OwnerTablesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string }>;
}) {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    redirect("/login");
  }

  const outlets = await getOwnerOutlets(session.company_id);
  const { outlet } = await searchParams;
  const target =
    outlets.find((o) => o.id === outlet) ?? outlets[0];
  if (!target) redirect("/outlets");
  redirect(`/outlets/${target.id}?tab=meja`);
}
