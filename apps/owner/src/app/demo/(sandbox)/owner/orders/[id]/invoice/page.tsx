"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import Invoice from "@/app/(dashboard)/orders/[id]/invoice/InvoicePageClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const routeParams = use(params);
  const order = useDemoView().orders.find(row => row.id === routeParams.id);
  if (!order) notFound();
  return <Invoice order={order} />;
}
