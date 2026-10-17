"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppliedDiscount, AppliedTax, CartItem } from "@rakku/shared-types";
import type { ToastType } from "./Toast";

export interface MerchantCartTotals {
  subtotal: number;
  totalProductDiscount: number;
  orderDiscount: AppliedDiscount | null;
  appliedTaxes: AppliedTax[];
  totalTaxAmount: number;
  appliedDiscounts: AppliedDiscount[];
  total: number;
  itemCount: number;
}

/** Client dependency boundary. A provider never grants access to production APIs. */
export interface MerchantRuntime {
  app: "owner" | "pos";
  scope: string;
  pathname: string;
  search: string;
  request: typeof fetch;
  active: () => boolean;
  navigation: {
    push: (href: string, options?: { scroll?: boolean }) => void;
    replace: (href: string, options?: { scroll?: boolean }) => void;
    back: () => void;
    refresh: () => void;
    forward: () => void;
    prefetch: (href: string) => void;
  };
  href: (href: string) => string;
  submit: (action: string) => void;
  getStore: <T>(key: string, create: () => T) => T;
  toast: (type: ToastType, message: string) => void;
  images: { create: (file: File) => string; revoke: (url: string) => void };
  cartTotals?: (items: CartItem[], tierId: string | null) => MerchantCartTotals;
  simulation?: (kind: "order-payment" | "subscription" | "withdrawal" | "email", id: string | null) => ReactNode;
}

const Context = createContext<MerchantRuntime | null>(null);

export function MerchantRuntimeProvider({ runtime, children }: { runtime: MerchantRuntime; children: ReactNode }) {
  return <Context.Provider value={runtime}>{children}</Context.Provider>;
}

export function useMerchantRuntime() { return useContext(Context); }
export function useMerchantRequest(): typeof fetch { return useMerchantRuntime()?.request ?? globalThis.fetch; }
