import { headers } from "next/headers";
import { redirect } from "next/navigation";
import PosShell from "@pos/components/layout/PosShell";
import { getTenantSessionFromCookies } from "@/lib/auth/tenant-session";
import { getAllowedMenus } from "@/lib/auth/menus";
import { createAdminClient } from "@/lib/db";

export const dynamic = "force-dynamic";
import { getUsageSummary } from "@rakku/plans";
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
    menus = [];
  }

  const requestPath = (await headers()).get("x-rakku-path") ?? "";
  const section = requestPath.split("/").filter(Boolean)[0] ?? "";
  if (section && section !== "access-denied"
    && !menus.some(menu => menu.slug === section || menu.path === `/${section}`)) {
    redirect("/access-denied");
  }

  const summary = await getUsageSummary(
    createAdminClient(),
    session.company_id
  );

  const upgradeUrl = `${
    process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000"
  }/subscription`;

  return <PosShell menus={menus} summary={summary} upgradeUrl={upgradeUrl}>{children}</PosShell>;
}
