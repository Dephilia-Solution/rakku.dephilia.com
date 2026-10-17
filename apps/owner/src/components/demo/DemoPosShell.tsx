"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardError from "@pos/app/(dashboard)/error";
import PosShell from "@pos/components/layout/PosShell";
import DemoControls from "./DemoControls";
import { useDemoView } from "./DemoProvider";

export default function DemoPosShell({ children }: { children: React.ReactNode }) {
  const view = useDemoView(), router = useRouter(), pathname = usePathname();
  useEffect(() => {
    if (!view.state.session.authenticated) router.replace("/demo/pos/login/select-outlet");
  }, [view.state.session.authenticated, router]);
  if (!view.state.session.authenticated || !view.usage) return null;
  const menu = pathname.slice("/demo/pos/".length).split("/")[0];
  const allowed = view.state.menus.includes(menu);
  return <PosShell menus={view.menus} summary={view.usage} upgradeUrl="/demo/owner/subscription" toolbar={<DemoControls app="pos" />}>
    {allowed ? children : <DashboardError error={new Error("Akses menu ditolak.")} reset={() => router.replace(`/demo/pos/${view.state.menus[0] ?? "login/select-outlet"}`)} />}
  </PosShell>;
}
