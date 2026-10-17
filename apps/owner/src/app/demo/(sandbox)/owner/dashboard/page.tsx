"use client";

import { OwnerDashboardView } from "@/components/owner/OwnerDashboardView";
import { useDemoView } from "@/components/demo/DemoProvider";

export default function Dashboard() {
  const view = useDemoView();
  if (!view.owner) return null;
  const orders = view.orders.filter(row => row.status === "completed");
  return <OwnerDashboardView owner={view.owner} outlets={view.outlets} employees={view.employees}
    totalRevenue={orders.reduce((sum, row) => sum + row.total_price, 0)} totalTransactions={orders.length}
    activeOutlets={view.outlets.filter(row => row.status === "active").length}
    activeEmployees={view.employees.filter(row => row.status === "active").length} />;
}
