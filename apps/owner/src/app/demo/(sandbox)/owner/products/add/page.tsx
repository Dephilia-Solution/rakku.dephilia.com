"use client";
import { notFound, useSearchParams } from "next/navigation";
import ProductForm from "@/components/products/ProductForm";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() {
  const view = useDemoView(), params = useSearchParams();
  const outlet = view.outlets.find(row => row.id === (params.get("outlet") ?? view.state.session.outlet_id));
  if (!outlet) notFound();
  return <ProductForm mode="add" outletId={outlet.id} outletName={outlet.name} categories={view.categories.filter(row => row.outlet_id === outlet.id)} pricingTiers={view.tiers.filter(row => row.outlet_id === outlet.id)} />;
}
