import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rakku POS - Stocko",
    short_name: "Rakku POS",
    description: "Point of Sale system for F&B businesses",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#2E7D32",
    dir: "ltr",
    lang: "id",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Kasir (Register)",
        short_name: "Register",
        description: "Buka halaman kasir POS",
        url: "/register?source=shortcut",
      },
      {
        name: "Pesanan",
        short_name: "Orders",
        description: "Lihat daftar pesanan",
        url: "/orders?source=shortcut",
      },
    ],
  };
}
