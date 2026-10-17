"use client";

import type { Menu, UsageSummary } from "@rakku/shared-types";
import { ToastContainer } from "@rakku/ui";
import ResponsiveNav from "./ResponsiveNav";
import DashboardContent from "./DashboardContent";
import PlanProvider from "../billing/PlanProvider";
import LimitBanner from "../billing/LimitBanner";

export default function PosShell({ menus, summary, upgradeUrl, children, toolbar }: {
  menus: Menu[]; summary: UsageSummary; upgradeUrl: string;
  children: React.ReactNode; toolbar?: React.ReactNode;
}) {
  const lockedPaths = summary.features.inventory_advanced ? [] : ["/purchases"];
  return <PlanProvider summary={summary} upgradeUrl={upgradeUrl}>
    <div className="flex min-h-dvh overflow-hidden">
      <ResponsiveNav menus={menus} lockedPaths={lockedPaths} />
      <DashboardContent>
        {toolbar && <div className="px-4 pt-3">{toolbar}</div>}
        <LimitBanner />
        {children}
      </DashboardContent>
      <ToastContainer />
    </div>
  </PlanProvider>;
}
