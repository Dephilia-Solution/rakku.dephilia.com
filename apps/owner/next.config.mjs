/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.RAKKU_ISOLATED_BUILD === "1" ? process.env.RAKKU_BUILD_DIRECTORY || ".next-hardening" : ".next",
  experimental: { cpus: 2 },
  async headers() {
    return [{ source: "/demo/:path*", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }] }];
  },
  async redirects() {
    return [
      { source: "/syarat-ketentuan", destination: "/terms", permanent: false },
      { source: "/kebijakan-privasi", destination: "/privacy", permanent: false },
      { source: "/demo/pos/admin/products/:path*", destination: "/demo/pos/products/:path*", permanent: false },
      { source: "/pricing-tiers", destination: "/products", permanent: false },
      { source: "/taxes", destination: "/tax-discounts?tab=pajak", permanent: false },
      { source: "/discounts", destination: "/tax-discounts?tab=produk", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.dephilia.com",
      },
    ],
  },
  transpilePackages: [
    "@rakku/shared-types",
    "@rakku/demo",
    "@rakku/db",
    "@rakku/auth-utils",
    "@rakku/ui",
    "@rakku/observability",
    "@rakku/emails",
    "@rakku/ledger",
    "@rakku/plans",
    "@rakku/payments",
    "@rakku/vessel-client",
  ],
};

export default nextConfig;
