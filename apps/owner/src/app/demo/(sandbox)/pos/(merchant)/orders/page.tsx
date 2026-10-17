"use client";
import Orders from "@pos/app/(dashboard)/orders/OrdersClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { return <Orders orders={useDemoView().orders} />; }
