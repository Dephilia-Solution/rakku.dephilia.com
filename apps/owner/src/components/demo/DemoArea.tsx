"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MerchantRuntimeProvider, type MerchantRuntime } from "@rakku/ui/merchant-runtime";
import { demoHref, demoLogicalPath, type DemoApplication } from "@rakku/demo/runtime";
import { DemoViewProvider, operationScope, useDemoSession, useDemoState } from "./DemoProvider";
import DemoSimulation from "./DemoSimulation";

const origins = {
  owner: process.env.NEXT_PUBLIC_OWNER_URL || (process.env.NODE_ENV === "production" ? "https://rakku.vercel.app" : "http://localhost:3000"),
  pos: process.env.NEXT_PUBLIC_POS_URL || "http://localhost:3001",
};

export function DemoArea({ app, children }: { app: DemoApplication; children: React.ReactNode }) {
  const { controller, logout } = useDemoSession();
  const state = useDemoState();
  const next = useRouter(), physicalPath = usePathname(), searchParams = useSearchParams();
  const ready = state.session.mode === app && (app !== "owner" || state.session.authenticated);
  useEffect(() => {
    if (ready) return;
    if (app === "owner") controller.sandbox.run({ type: "session.owner" });
    else controller.sandbox.run({ type: "session.switchUser" });
  }, [app, controller, ready]);
  const scope = operationScope(controller.sandbox);
  const services = useMemo(() => controller.services(app, scope), [controller, app, scope]);
  const href = useCallback((value: string) => demoHref(app, value, origins), [app]);
  const navigation = useMemo<MerchantRuntime["navigation"]>(() => ({
    push: (value, options) => next.push(href(value), options),
    replace: (value, options) => next.replace(href(value), options),
    back: () => next.back(), forward: () => next.forward(),
    refresh: () => next.refresh(), prefetch: () => {},
  }), [next, href]);
  const submit = useCallback((action: string) => {
    const path = new URL(action, "https://demo.rakku.invalid").pathname;
    if (path === "/api/auth/tenant/switch-user") {
      // The login layout clears the actor after navigation commits. Clearing it
      // here races the merchant guard and redirects select-user to select-outlet.
      next.push("/demo/pos/login/select-user");
    } else if (["/api/auth/owner/logout", "/api/auth/tenant/logout", "/api/auth/logout"].includes(path)) logout();
    else throw new Error("Aksi demo tidak tersedia.");
  }, [next, logout]);
  const simulation = useCallback<NonNullable<MerchantRuntime["simulation"]>>((kind, id) => <DemoSimulation kind={kind} id={id} />, []);
  const runtime = useMemo<MerchantRuntime>(() => ({
    app, scope: `${controller.sandbox.generation}:${scope}`,
    pathname: demoLogicalPath(app, physicalPath), search: searchParams.toString(),
    request: services.request, active: services.active,
    navigation, href, submit, getStore: controller.getStore,
    toast: services.toast, images: services.images, cartTotals: services.cartTotals, simulation,
  }), [app, controller, scope, physicalPath, searchParams, services, navigation, href, submit, simulation]);
  if (!ready) return <div className="p-8 text-center text-sm text-on-surface-variant">Memuat Rakku…</div>;
  return <MerchantRuntimeProvider runtime={runtime}>
    <DemoViewProvider adapter={services.request}>{children}</DemoViewProvider>
  </MerchantRuntimeProvider>;
}
