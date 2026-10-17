/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { cpus: 2 },
  async headers() {
    return [{ source: "/demo/:path*", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }] }];
  },
  async redirects() {
    return [
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
    "@rakku/emails",
    "@rakku/ledger",
    "@rakku/plans",
    "@rakku/payments",
    "@rakku/vessel-client",
  ],
};

export default nextConfig;
