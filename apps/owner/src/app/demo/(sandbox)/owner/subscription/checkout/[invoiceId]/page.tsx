"use client";
import { notFound } from "next/navigation";
import Checkout from "@/components/billing/CheckoutClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page({ params }: { params: { invoiceId: string } }) {
  const invoice = useDemoView().invoices.find(row => row.id === params.invoiceId);
  if (!invoice) notFound();
  return <Checkout invoice={invoice} planName={invoice.plans.name} />;
}
