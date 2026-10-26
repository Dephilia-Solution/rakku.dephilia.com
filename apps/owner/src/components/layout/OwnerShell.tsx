"use client";

import type { OwnerDashboardOutlet, UsageSummary } from "@rakku/shared-types";
import { ToastContainer } from "@rakku/ui";
import ResponsiveNav from "./ResponsiveNav";
import DashboardContent from "./DashboardContent";
import PlanProvider from "../billing/PlanProvider";
import OutletScopeProvider from "../outlet/OutletScopeProvider";
import PlanBanner from "../billing/PlanBanner";

export default function OwnerShell({ owner, summary, outlets, children, toolbar }: {
  owner: { name: string; email: string; companyName: string; companyCode: string };
  summary: UsageSummary;
  outlets?: OwnerDashboardOutlet[];
  children: React.ReactNode;
  toolbar?: React.ReactNode;
}) {
  return <PlanProvider summary={summary}>
    <OutletScopeProvider initialOutlets={outlets ?? []}>
      <div className="flex min-h-dvh overflow-hidden bg-neutral-50">
        <ResponsiveNav owner={owner} summary={summary} />
        <DashboardContent>
          {toolbar}
          <PlanBanner />
          {children}
        </DashboardContent>
        <ToastContainer />
      </div>
    </OutletScopeProvider>
  </PlanProvider>;
}
