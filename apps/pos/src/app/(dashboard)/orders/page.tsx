import { getOrders } from "@/lib/supabase/queries.server";
import OrdersClient from "./OrdersClient";

export default async function OrdersPage() {
  const orders = await getOrders();
  return <OrdersClient orders={orders} />;
}
