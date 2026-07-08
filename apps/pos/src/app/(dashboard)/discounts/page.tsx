import { getAllProductDiscounts, getAllOrderDiscounts } from "@/lib/supabase/queries.server";
import DiscountsClient from "./DiscountsClient";

export default async function DiscountsPage() {
  const [productDiscounts, orderDiscounts] = await Promise.all([
    getAllProductDiscounts(),
    getAllOrderDiscounts(),
  ]);
  return (
    <DiscountsClient
      initialProductDiscounts={productDiscounts}
      initialOrderDiscounts={orderDiscounts}
    />
  );
}
