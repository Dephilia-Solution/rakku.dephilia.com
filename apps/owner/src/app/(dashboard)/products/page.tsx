import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets } from "@/lib/supabase/queries.owner";
import OwnerProductsClient from "./OwnerProductsClient";

export default async function OwnerProductsPage() {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    redirect("/login");
  }

  const outlets = await getOwnerOutlets(session.company_id);

  return (
    <Suspense>
      <OwnerProductsClient
        outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
      />
    </Suspense>
  );
}
