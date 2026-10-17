"use client";
import { notFound } from "next/navigation";
import Invoice from "@pos/app/(dashboard)/orders/[id]/invoice/InvoicePageClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page({ params }: { params: { id: string } }) {
  const order = useDemoView().orders.find(row => row.id === params.id);
  if (!order) notFound();
  return <Invoice order={order} />;
}
