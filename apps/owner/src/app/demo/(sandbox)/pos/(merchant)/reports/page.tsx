"use client";
import Reports from "@pos/app/(dashboard)/reports/ReportsClient";
import { useDemoView } from "@/components/demo/DemoProvider";
export default function Page() { return <Reports orders={useDemoView().orders.filter(order => order.status === "completed")} />; }
