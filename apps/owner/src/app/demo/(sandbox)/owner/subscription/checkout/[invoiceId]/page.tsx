"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import Checkout from "@/components/billing/CheckoutClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page({ params }: { params: Promise<{ invoiceId: string }> }) {
  const routeParams = use(params);
  const invoice = useDemoView().invoices.find(row => row.id === routeParams.invoiceId);
  if (!invoice) notFound();
  return <Checkout invoice={invoice} planName={invoice.plans.name} />;
}
