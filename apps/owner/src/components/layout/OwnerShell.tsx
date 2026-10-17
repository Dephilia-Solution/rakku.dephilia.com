"use client";

import type { UsageSummary } from "@rakku/shared-types";
import { ToastContainer } from "@rakku/ui";
import ResponsiveNav from "./ResponsiveNav";
import DashboardContent from "./DashboardContent";
import PlanProvider from "../billing/PlanProvider";
import PlanBanner from "../billing/PlanBanner";

export default function OwnerShell({ owner, summary, children, toolbar }: {
  owner: { name: string; email: string; companyName: string; companyCode: string };
  summary: UsageSummary;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
}) {
  return <PlanProvider summary={summary}>
    <div className="flex min-h-dvh overflow-hidden bg-neutral-50">
      <ResponsiveNav owner={owner} />
      <DashboardContent>
        {toolbar}
        <PlanBanner />
        {children}
      </DashboardContent>
      <ToastContainer />
    </div>
  </PlanProvider>;
}
