import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets } from "@/lib/supabase/queries.owner";
import OutletWorkspaceClient from "@/components/outlet/OutletWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function OwnerOutletWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ outletId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getOwnerSessionFromCookies();
  if (!session) redirect("/login");
  if (!session.company_id) redirect("/onboarding");

  const [{ outletId }, { tab }] = await Promise.all([params, searchParams]);
  const outlets = await getOwnerOutlets(session.company_id);
  const outlet = outlets.find((o) => o.id === outletId);
  if (!outlet) redirect("/outlets");

  return (
    <OutletWorkspaceClient
      outlet={outlet}
      initialTab={tab}
    />
  );
}
