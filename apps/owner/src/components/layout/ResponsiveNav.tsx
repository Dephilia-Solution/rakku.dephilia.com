"use client";

import { useNavMode } from "@/hooks/useNavMode";
import type { UsageSummary } from "@rakku/shared-types";
import BottomNav from "./BottomNav";
import OwnerSidebar from "@/components/owner/OwnerSidebar";

interface ResponsiveNavProps {
  summary: UsageSummary;
  owner: {
    name: string;
    email: string;
    companyName: string;
    companyCode: string;
  };
}

export default function ResponsiveNav({ owner, summary }: ResponsiveNavProps) {
  const mode = useNavMode();

  if (mode === "sidebar") {
    return <OwnerSidebar owner={owner} summary={summary} />;
  }

  return <BottomNav />;
}
