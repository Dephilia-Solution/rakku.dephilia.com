"use client";

import type { OwnerDashboardOutlet, UsageSummary } from "@rakku/shared-types";
import { ToastContainer } from "@rakku/ui";
import ResponsiveNav from "./ResponsiveNav";
import DashboardContent from "./DashboardContent";
import PlanProvider from "../billing/PlanProvider";
import OutletScopeProvider from "../outlet/OutletScopeProvider";
import PlanBanner from "../billing/PlanBanner";
import OwnerDataCache from "../data/OwnerDataCache";

export default function OwnerShell({ owner, summary, outlets, children, toolbar, cacheScope }: {
  owner: { name: string; email: string; companyName: string; companyCode: string };
  summary: UsageSummary;
  outlets?: OwnerDashboardOutlet[];
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  cacheScope?: string;
}) {
  return <OwnerDataCache key={cacheScope ?? owner.companyCode}>
    <PlanProvider summary={summary}>
    <OutletScopeProvider initialOutlets={outlets ?? []} preferenceScope={owner.companyCode}>
      <div className="owner-app flex min-h-dvh bg-neutral-50">
        <a href="#owner-main-content" className="owner-skip-link">Lewati navigasi</a>
        <ResponsiveNav owner={owner} summary={summary} />
        <DashboardContent>
          {toolbar}
          <PlanBanner />
          <div className="owner-page">{children}</div>
        </DashboardContent>
        <ToastContainer />
      </div>
    </OutletScopeProvider>
  </PlanProvider>
  </OwnerDataCache>;
}
