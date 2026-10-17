"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter, useSearchParams as useNextSearchParams } from "next/navigation";
import { useMemo, type AnchorHTMLAttributes, type FormHTMLAttributes } from "react";
import { showToast as productionToast } from "@rakku/ui";
import { useMerchantRuntime } from "@rakku/ui/merchant-runtime";
export { useMerchantRuntime, useMerchantRequest } from "@rakku/ui/merchant-runtime";

export function useRouter() {
  const fallback = useNextRouter();
  return useMerchantRuntime()?.navigation ?? fallback;
}
export function usePathname() {
  const fallback = useNextPathname();
  return useMerchantRuntime()?.pathname ?? fallback;
}
export function useSearchParams() {
  const fallback = useNextSearchParams();
  const runtime = useMerchantRuntime();
  const params = useMemo(() => new URLSearchParams(runtime?.search ?? ""), [runtime?.search]);
  return runtime ? params : fallback;
}
export function useMerchantToast() { return useMerchantRuntime()?.toast ?? productionToast; }
export function useMerchantImages() {
  return useMerchantRuntime()?.images ?? { create: (file: File) => URL.createObjectURL(file), revoke: (url: string) => URL.revokeObjectURL(url) };
}
type Props = LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;
export function MerchantLink({ href, as, replace, scroll, prefetch, onClick, ...props }: Props) {
  const runtime = useMerchantRuntime();
  if (!runtime) return <Link href={href} as={as} replace={replace} scroll={scroll} prefetch={prefetch} onClick={onClick} {...props} />;
  const path = typeof href === "string" ? href : `${href.pathname ?? ""}${href.query ? `?${new URLSearchParams(href.query as Record<string, string>)}` : ""}`;
  const resolved = runtime.href(path);
  const privateRoute = resolved.startsWith("/demo/owner/") || resolved.startsWith("/demo/pos/");
  return <Link {...props} target={privateRoute ? undefined : props.target} href={resolved} replace={replace} scroll={scroll} prefetch={false} onClick={onClick} />;
}
export function MerchantForm({ action, onSubmit, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  const runtime = useMerchantRuntime();
  return <form {...props} action={runtime ? undefined : action} onSubmit={event => {
    onSubmit?.(event);
    if (!runtime || event.defaultPrevented) return;
    event.preventDefault();
    if (typeof action !== "string") throw new Error("Unsupported demo form action");
    runtime.submit(action);
  }} />;
}
