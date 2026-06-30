import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import ToastContainer from "@/components/shared/Toast";
import { SessionRefresher } from "@/components/auth/SessionRefresher";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { getAllowedMenus } from "@/lib/auth/menus";
import type { Menu } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getTenantSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  let menus: Menu[] = [];
  try {
    menus = await getAllowedMenus(session.role_id);
  } catch {
    // If DB query fails, just use empty menus
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar menus={menus} />
      <main className="flex-1 lg:ml-16 pb-[56px] lg:pb-0">{children}</main>
      <MobileBottomNav menus={menus} />
      <ToastContainer />
      <SessionRefresher />
    </div>
  );
}
