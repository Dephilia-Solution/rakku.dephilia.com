"use client";

import { useNavMode } from "@/hooks/useNavMode";
import BottomNav from "./BottomNav";
import OwnerSidebar from "@/components/owner/OwnerSidebar";

interface ResponsiveNavProps {
  owner: {
    name: string;
    email: string;
    companyName: string;
    companyCode: string;
  };
}

export default function ResponsiveNav({ owner }: ResponsiveNavProps) {
  const mode = useNavMode();

  if (mode === "sidebar") {
    return <OwnerSidebar owner={owner} />;
  }

  return <BottomNav />;
}
