export type DemoApplication = "owner" | "pos";

export function demoLogicalPath(app: DemoApplication, pathname: string): string {
  const prefix = `/demo/${app}`;
  const path = pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : "/";
  return path === "/admin/products" ? "/products" : path;
}

/** Resolve only known merchant destinations. Private links remain inside the sandbox. */
export function demoHref(
  app: DemoApplication,
  href: string,
  origins: { owner?: string; pos?: string } = {},
): string {
  if (href.startsWith("#")) return href;
  let destination = href;
  let target = app;
  if (/^https?:\/\//.test(href)) {
    const url = new URL(href);
    const owner = origins.owner ? new URL(origins.owner).origin : undefined;
    const pos = origins.pos ? new URL(origins.pos).origin : undefined;
    if (url.origin === pos) target = "pos";
    else if (url.origin === owner) target = "owner";
    else throw new Error("Tautan berada di luar demo Rakku.");
    destination = `${url.pathname}${url.search}${url.hash}`;
  }
  if (!destination.startsWith("/") || destination.startsWith("//")) throw new Error("Tautan demo tidak valid.");
  if (destination === "/demo" || destination.startsWith("/demo/") || destination.startsWith("/demo?")) return destination;
  const url = new URL(destination, "https://demo.rakku.invalid");
  let path = url.pathname;
  if (path.startsWith("/api/")) throw new Error("API bukan tujuan navigasi demo.");
  if (path === "/admin/products" || path.startsWith("/admin/products/")) path = path.replace("/admin/products", "/products");
  if (path === "/pricing-tiers" || path === "/categories") path = "/products";
  if (path === "/taxes") { path = "/tax-discounts"; url.searchParams.set("tab", "pajak"); }
  if (path === "/discounts") { path = "/tax-discounts"; url.searchParams.set("tab", "produk"); }
  if (path === "/") path = target === "owner" ? "/dashboard" : "/login/select-outlet";
  return `/demo/${target}${path}${url.search}${url.hash}`;
}
