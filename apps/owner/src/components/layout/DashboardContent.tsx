"use client";

import { useEffect } from "react";
import { useSidebarStoreApi } from "@/lib/store/sidebarStore";

export default function DashboardContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebar = useSidebarStoreApi();
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
    <main id="owner-main-content" className="owner-main flex-1 min-w-0 pb-[var(--nav-bottom-safe)] md:pb-0 transition-[margin-left] duration-[250ms] ease-in-out" tabIndex={-1}>
      <div className="owner-content">{children}</div>
    </main>
  );
}
