"use client";

import OwnerShell from "@/components/layout/OwnerShell";
import DemoControls from "./DemoControls";
import { useDemoView } from "./DemoProvider";

export default function DemoOwnerShell({ children }: { children: React.ReactNode }) {
  const view = useDemoView();
  if (!view.owner || !view.usage) return null;
  return <OwnerShell owner={{ name: view.owner.name, email: view.owner.email, companyName: view.company.name, companyCode: view.company.code }} summary={view.usage} toolbar={<DemoControls app="owner" />}>
    {children}
  </OwnerShell>;
}
