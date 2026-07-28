import { redirect } from "next/navigation";
import ResponsiveNav from "@/components/layout/ResponsiveNav";
import { ToastContainer } from "@rakku/ui";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { getAllowedMenus } from "@/lib/auth/menus";
import type { Menu } from "@rakku/shared-types";

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
    <div className="flex min-h-dvh overflow-hidden">
      <ResponsiveNav menus={menus} />
      <main className="flex-1 min-w-0 overflow-hidden md:ml-60 pb-[var(--nav-bottom-safe)] md:pb-0">{children}</main>
      <ToastContainer />
    </div>
  );
}
