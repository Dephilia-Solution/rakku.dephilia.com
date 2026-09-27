"use client";

import { useEffect } from "react";
import { useSidebarStore } from "@/lib/store/sidebarStore";

export default function DashboardContent({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    useSidebarStore.getState().hydrate();
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
  }, []);

  return (
    <main className="owner-main flex-1 min-w-0 overflow-hidden pb-[var(--nav-bottom-safe)] md:pb-0 pt-4 md:pt-0 transition-[margin-left] duration-[250ms] ease-in-out">
      <div className="p-4 lg:p-8">{children}</div>
    </main>
  );
}
