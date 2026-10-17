"use client";
import Subscription from "@/components/billing/SubscriptionClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { const view = useDemoView(); return view.usage ? <Subscription summary={view.usage} plans={view.plans} invoices={view.invoices} /> : null; }
