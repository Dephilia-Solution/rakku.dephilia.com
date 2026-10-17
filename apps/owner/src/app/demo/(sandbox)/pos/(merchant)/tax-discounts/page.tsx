"use client";
import Charges from "@pos/app/(dashboard)/tax-discounts/TaxDiscountsClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() {
  const view = useDemoView();
  return <Charges initialTaxes={view.taxes} initialProductDiscounts={view.productDiscounts} initialOrderDiscounts={view.orderDiscounts} productNames={Object.fromEntries(view.products.map(row => [row.id, row.name]))} />;
}
