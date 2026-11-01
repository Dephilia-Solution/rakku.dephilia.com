import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import { CacheFirst, NetworkOnly, StaleWhileRevalidate } from "serwist";
import { ExpirationPlugin } from "serwist";
import { CacheableResponsePlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Public demo lives on the Owner origin. Never cache this redirect or demo RSC.
    {
      matcher: ({ url }) => url.pathname === "/demo" || url.pathname.startsWith("/demo/"),
      handler: new NetworkOnly(),
    },
    // Authenticated documents, API responses and RSC payloads must never survive a session.
    {
      matcher: ({ request, url }) => request.mode === "navigate" || url.pathname.startsWith("/api/")
        || request.headers.get("RSC") === "1" || url.searchParams.has("_rsc"),
      handler: new NetworkOnly(),
    },

    // Static assets (JS, CSS, fonts): cache first
    {
      matcher: ({ request }) =>
        request.destination === "script" ||
        request.destination === "style" ||
        request.destination === "font",
      handler: new CacheFirst({
        cacheName: "static-resources",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },

    // Images: stale while revalidate (incl. Supabase product images)
    {
      matcher: ({ request }) => request.destination === "image",
      handler: new StaleWhileRevalidate({
        cacheName: "images",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },

  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => !["static-resources", "images"].includes(key) && !key.includes("precache"))
    .map(key => caches.delete(key)))));
});
serwist.addEventListeners();
