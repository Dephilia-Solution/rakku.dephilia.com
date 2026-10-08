/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { cpus: 2 },
  async redirects() {
    return [
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
