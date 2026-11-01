"use client";

import { useMemo } from "react";
import { OwnerDashboardView } from "@/components/owner/OwnerDashboardView";
import { useDemoState } from "@/components/demo/DemoProvider";
import { aggregateDemoOwnerDashboard } from "@rakku/demo/runtime";

export default function Dashboard() {
  const state = useDemoState();
  const analytics = useMemo(() => aggregateDemoOwnerDashboard(state, { range: "today" }), [state]);
  return <OwnerDashboardView owner={{ name: state.company.owner_name }} initialAnalytics={analytics} />;
}
