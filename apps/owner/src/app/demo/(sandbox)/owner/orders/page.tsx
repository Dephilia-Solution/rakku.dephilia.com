"use client";
import Orders from "@/app/(dashboard)/orders/OrdersClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { const view = useDemoView(); return <Orders outlets={view.outlets} />; }
