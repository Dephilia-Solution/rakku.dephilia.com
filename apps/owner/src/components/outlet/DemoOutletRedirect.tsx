"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "@/lib/merchant-runtime";
import { useDemoView } from "@/components/demo/DemoProvider";

/** Redirect client untuk demo: rute kelola lama diarahkan ke workspace outlet. */
export default function DemoOutletRedirect({ tab }: { tab: string }) {
  const view = useDemoView();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const outletParam = searchParams.get("outlet");
    const outlet =
      view.outlets.find((o) => o.id === outletParam) ?? view.outlets[0];
    if (!outlet) return;
    const oldTab = searchParams.get("tab");
    const charge = tab === "pajak" && (oldTab === "produk" || oldTab === "order") ? `&charge=${oldTab}` : "";
    router.replace(`/outlets/${outlet.id}?tab=${tab}${charge}`);
  }, [router, searchParams, view.outlets, tab]);

  return null;
}
