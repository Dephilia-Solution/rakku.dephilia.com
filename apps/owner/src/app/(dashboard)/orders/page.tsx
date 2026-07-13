import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import { getOwnerOutlets } from "@/lib/supabase/queries.owner";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";

export default async function OrdersPage() {
  const session = await getOwnerSessionFromCookies();
  if (!session || !session.company_id) {
    redirect("/login");
  }

  const outlets = await getOwnerOutlets(session.company_id);

  return (
    <OrdersClient
      outlets={outlets.map((o) => ({ id: o.id, name: o.name }))}
    />
  );
}
