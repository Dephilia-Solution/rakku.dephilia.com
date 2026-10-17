"use client";
import { useSearchParams } from "next/navigation";
import Charges from "@/app/(dashboard)/tax-discounts/TaxDiscountsClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() {
  const view = useDemoView(), params = useSearchParams();
  const tab = params.get("tab");
  return <Charges outlets={view.outlets} initialTab={tab === "produk" || tab === "order" ? tab : "pajak"} />;
}
