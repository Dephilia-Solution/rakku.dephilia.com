import { getOrders } from "@/lib/supabase/queries.server";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  const orders = await getOrders();

  return <ReportsClient orders={orders} />;
}
