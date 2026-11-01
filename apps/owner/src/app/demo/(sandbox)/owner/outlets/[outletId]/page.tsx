"use client";
import { use, useEffect } from "react";
import { useRouter } from "@/lib/merchant-runtime";
import OutletWorkspaceClient from "@/components/outlet/OutletWorkspaceClient";
import { useDemoView } from "@/components/demo/DemoProvider";

export default function Page({ params }: { params: Promise<{ outletId: string }> }) {
  const routeParams = use(params);
  const view = useDemoView();
  const router = useRouter();
  const outlet = view.outlets.find((row) => row.id === routeParams.outletId || encodeURIComponent(row.id) === routeParams.outletId);

  useEffect(() => {
    if (!outlet) router.replace("/outlets");
  }, [outlet, router]);

  if (!outlet) return null;
  return <OutletWorkspaceClient outlet={outlet} />;
}
