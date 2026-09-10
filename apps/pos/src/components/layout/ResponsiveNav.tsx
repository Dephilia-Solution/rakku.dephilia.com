"use client";

import { useNavMode } from "@/hooks/useNavMode";
import BottomNav from "./BottomNav";
import SideRail from "./SideRail";
import AppSidebar from "./AppSidebar";
import type { Menu } from "@rakku/shared-types";

interface ResponsiveNavProps {
  menus: Menu[];
  lockedPaths?: string[];
}

export default function ResponsiveNav({
  menus,
  lockedPaths = [],
}: ResponsiveNavProps) {
  const mode = useNavMode();

  if (mode === "sidebar") {
    return <AppSidebar menus={menus} lockedPaths={lockedPaths} />;
  }

  if (mode === "rail") {
    return <SideRail menus={menus} lockedPaths={lockedPaths} />;
  }

  return (
    <BottomNav menus={menus} primaryCount={5} lockedPaths={lockedPaths} />
  );
}
