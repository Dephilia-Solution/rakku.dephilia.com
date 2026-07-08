"use client";

import { useNavMode } from "@/hooks/useNavMode";
import BottomNav from "./BottomNav";
import SideRail from "./SideRail";
import AppSidebar from "./AppSidebar";
import type { Menu } from "@rakku/shared-types";

interface ResponsiveNavProps {
  menus: Menu[];
}

export default function ResponsiveNav({ menus }: ResponsiveNavProps) {
  const mode = useNavMode();

  if (mode === "sidebar") {
    return <AppSidebar menus={menus} />;
  }

  if (mode === "rail") {
    return <SideRail menus={menus} />;
  }

  return <BottomNav menus={menus} primaryCount={4} />;
}
