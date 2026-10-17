"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { createDemoSandbox, type DemoSandbox, type DemoOrder } from "@rakku/demo";
import { createDemoRequestAdapter, orderPayload, type DemoApplication, type DemoRequestAdapter } from "@rakku/demo/runtime";
import type { MerchantCartTotals, MerchantRuntime } from "@rakku/ui/merchant-runtime";
import { showToast } from "@rakku/ui";

export const operationScope = (sandbox: DemoSandbox) => {
  const { session } = sandbox.getSnapshot();
  return `${session.mode}:${session.outlet_id}:${session.employee_id ?? ""}:${session.authenticated}`;
};

/** Ownership lasts for the common route-group layout, not an individual screen. */
export class DemoController {
  readonly sandbox = createDemoSandbox();
  private destroyed = false;
  private stores = new Map<string, unknown>();
  private adapters = new Map<string, ReturnType<DemoController["createServices"]>>();
  private unsubscribe: () => void;

  constructor() {
    let previous = operationScope(this.sandbox);
    this.unsubscribe = this.sandbox.subscribe(() => {
      const next = operationScope(this.sandbox);
      if (next !== previous) {
        for (const key of this.stores.keys()) if (key.includes(":cart")) this.stores.delete(key);
        previous = next;
      }
    });
  }

  active = (scope?: string) => {
    if (this.destroyed) return false;
    return !scope || operationScope(this.sandbox) === scope;
  };

  getStore = <T,>(key: string, create: () => T): T => {
    if (!this.active()) throw new Error("Sesi demo sudah berakhir.");
    if (!this.stores.has(key)) this.stores.set(key, create());
    return this.stores.get(key) as T;
  };

  private createServices(app: DemoApplication, scope: string) {
    const active = () => this.active(scope);
    // Auth requests legitimately change employee/outlet scope before their response
    // is consumed. The adapter validates permissions; its lifetime follows generation.
    const request = createDemoRequestAdapter(this.sandbox, { app, active: () => this.active(), publicMenuBaseUrl: window.location.origin });
    const toast: MerchantRuntime["toast"] = (type, message) => { if (active()) showToast(type, message); };
    const images: MerchantRuntime["images"] = {
      create: file => { if (!active()) throw new Error("Sesi demo sudah berakhir."); return this.sandbox.attachImage(file); },
      revoke: url => { if (this.active()) this.sandbox.removeImage(url); },
    };
    const cartTotals: NonNullable<MerchantRuntime["cartTotals"]> = (items, tierId) => {
      if (!items.length || !tierId) return EMPTY_TOTALS;
      const state = this.sandbox.getSnapshot();
      const input = orderPayload(state, { items, pricingTierId: tierId, customerName: "Pelanggan Demo" });
      const quote = this.sandbox.run({ type: "order.quote", ...input }, this.sandbox.generation) as DemoOrder;
      const productDiscount = quote.items.reduce((sum, item) => sum + item.unit_price * item.quantity - item.subtotal, 0);
      const orderDiscountAmount = quote.discount_amount - productDiscount;
      const discount = request.getViewData().activeOrderDiscounts[0];
      return {
        subtotal: quote.subtotal,
        totalProductDiscount: productDiscount,
        orderDiscount: discount && orderDiscountAmount > 0 ? { name: discount.name, type: discount.type, value: discount.value, amount: orderDiscountAmount } : null,
        appliedTaxes: quote.taxes ?? [], totalTaxAmount: quote.tax_amount,
        appliedDiscounts: quote.discounts ?? [], total: quote.total,
        itemCount: quote.items.reduce((sum, item) => sum + item.quantity, 0),
      };
    };
    return { active, request, toast, images, cartTotals };
  }

  services(app: DemoApplication, scope: string) {
    const key = `${app}:${scope}`;
    let value = this.adapters.get(key);
    if (!value) { value = this.createServices(app, scope); this.adapters.set(key, value); }
    return value;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe();
    for (const service of this.adapters.values()) service.request.destroy();
    this.adapters.clear(); this.stores.clear(); this.sandbox.destroy();
  }
}

const EMPTY_TOTALS: MerchantCartTotals = { subtotal: 0, totalProductDiscount: 0, orderDiscount: null, appliedTaxes: [], totalTaxAmount: 0, appliedDiscounts: [], total: 0, itemCount: 0 };
interface ContextValue { controller: DemoController; reset: () => void; logout: () => void }
const Context = createContext<ContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [controller, setController] = useState<DemoController | null>(null);
  const active = useRef<DemoController | null>(null);
  useEffect(() => {
    const attrs = ["data-owner-sidebar", "data-pos-sidebar", "data-sidebar-ready"];
    const previous = attrs.map(key => [key, document.documentElement.getAttribute(key)] as const);
    const fresh = new DemoController(); active.current = fresh; setController(fresh);
    const show = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      const next = new DemoController(); active.current = next;
      flushSync(() => setController(next));
    };
    const hide = () => {
      const old = active.current; active.current = null;
      flushSync(() => setController(null)); old?.destroy();
    };
    window.addEventListener("pageshow", show); window.addEventListener("pagehide", hide);
    return () => {
      window.removeEventListener("pageshow", show); window.removeEventListener("pagehide", hide);
      active.current?.destroy(); active.current = null;
      for (const [key, value] of previous) {
        if (value === null) document.documentElement.removeAttribute(key);
        else document.documentElement.setAttribute(key, value);
      }
    };
  }, []);
  const replace = (exit: boolean) => {
    const old = active.current, fresh = new DemoController(); active.current = fresh;
    flushSync(() => setController(fresh)); old?.destroy();
    if (exit) router.replace("/demo");
  };
  if (!controller) return <div className="p-8 text-center text-sm text-on-surface-variant">Memuat Rakku…</div>;
  return <Context.Provider key={controller.sandbox.generation} value={{ controller, reset: () => replace(false), logout: () => replace(true) }}>
    <DemoClock controller={controller} />{children}
  </Context.Provider>;
}

function DemoClock({ controller }: { controller: DemoController }) {
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!controller.active()) return;
      const now = new Date().toISOString();
      if (now > controller.sandbox.getSnapshot().now) controller.sandbox.run({ type: "tick", now });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [controller]);
  return null;
}

export function useDemoSession() {
  const context = useContext(Context);
  if (!context) throw new Error("Konteks demo tidak tersedia.");
  return context;
}

export function useDemoState() {
  const { controller } = useDemoSession();
  return useSyncExternalStore(controller.sandbox.subscribe, controller.sandbox.getSnapshot, controller.sandbox.getSnapshot);
}

const ViewContext = createContext<DemoRequestAdapter | null>(null);
export function DemoViewProvider({ adapter, children }: { adapter: DemoRequestAdapter; children: React.ReactNode }) {
  return <ViewContext.Provider value={adapter}>{children}</ViewContext.Provider>;
}
export function useDemoView() {
  useDemoState();
  const adapter = useContext(ViewContext);
  if (!adapter) throw new Error("Penyedia data demo tidak tersedia.");
  return adapter.getViewData();
}
