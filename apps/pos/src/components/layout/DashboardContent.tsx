"use client";

import { useEffect } from "react";
import { useSidebarStoreApi } from "@pos/lib/store/sidebarStore";
import { useNavMode } from "@pos/hooks/useNavMode";

export default function DashboardContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebar = useSidebarStoreApi();
  const mode = useNavMode();
  useEffect(() => {
    sidebar.getState().hydrate();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        document.documentElement.setAttribute("data-sidebar-ready", "true");
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [sidebar]);

  return (
    <main data-nav-mode={mode} className="pos-main flex-1 min-w-0 overflow-hidden pb-[var(--nav-bottom-safe)] md:pb-0 transition-[margin-left] duration-[250ms] ease-in-out">
      {children}
    </main>
  );
}
