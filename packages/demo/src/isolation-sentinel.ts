// Test-only preload: install BEFORE importing the domain in a fresh process.
import * as Module from "node:module";
const hooks = Module as unknown as { registerHooks: (hooks: { resolve: (specifier: string, context: unknown, next: (specifier: string, context: unknown) => { url: string }) => { url: string } }) => unknown };
hooks.registerHooks({ resolve(specifier, context, next) {
  if (/^@rakku\/(?:db|auth-utils|supabase-clients|vessel-client|echo-client|silos-client|payments|ledger|inventory|plans|pricing|emails)(?:\/|$)/.test(specifier) || /^@neondatabase\/(?:auth|serverless)(?:\/|$)/.test(specifier) || /(?:^|\/)(?:postgres|better-auth|@supabase)(?:\/|$)/.test(specifier)) {
    throw new Error(`Production provider sentinel: ${specifier}`);
  }
  const resolved = next(specifier, context);
  if (/\/packages\/(?:db|auth-utils|supabase-clients|vessel-client|echo-client|silos-client)\//.test(resolved.url)) throw new Error(`Production provider sentinel: ${resolved.url}`);
  return resolved;
} });
for (const key of ["localStorage", "sessionStorage", "indexedDB", "caches", "cookieStore", "document", "navigator", "XMLHttpRequest", "WebSocket", "BroadcastChannel"]) {
  Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(`Storage/network sentinel: ${key}`); } });
}
globalThis.fetch = (() => { throw new Error("External provider sentinel: fetch"); }) as typeof fetch;
