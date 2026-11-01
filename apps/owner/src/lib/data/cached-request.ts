import type { QueryClient } from "@tanstack/react-query";

const catalogPaths = new Set([
  "/api/owner/products", "/api/owner/categories", "/api/owner/pricing-tiers",
  "/api/owner/product-tier-prices", "/api/owner/taxes", "/api/owner/discounts",
]);
const prefix = ["owner-catalog"] as const;
type CachedResponse = { body: string; status: number; headers: [string, string][] };

/** Private, memory-only display cache. Authentication, stock, money and writes always use the network. */
export function createCachedOwnerRequest(client: QueryClient, request: typeof fetch): typeof fetch {
  return async (input, init) => {
    const path = typeof input === "string" && input.startsWith("/api/owner/") ? input : null;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const signal = init?.signal;
    signal?.throwIfAborted();
    if (!path || method !== "GET" || !catalogPaths.has(path.split("?")[0]) || init?.cache === "no-store" || init?.headers || init?.credentials === "omit") {
      const response = await request(input, init);
      if (response.ok && path && !["GET", "HEAD", "OPTIONS"].includes(method)) {
        await client.cancelQueries({ queryKey: prefix });
        await client.invalidateQueries({ queryKey: prefix });
      }
      return response;
    }
    try {
      const cached = await client.fetchQuery<CachedResponse>({
        queryKey: [...prefix, path],
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: false,
        queryFn: async ({ signal: querySignal }) => {
          // A tab unmount must not cancel another consumer of the same GET.
          const response = await request(input, { ...init, signal: querySignal });
          if (!response.ok) throw response;
          return { body: await response.text(), status: response.status, headers: Array.from(response.headers.entries()) };
        },
      });
      signal?.throwIfAborted();
      return new Response(cached.body, { status: cached.status, headers: cached.headers });
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof Response) return error.clone();
      throw error;
    }
  };
}
