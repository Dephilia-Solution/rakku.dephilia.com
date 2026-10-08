/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { cpus: 2 },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.dephilia.com",
      },
    ],
  },
  transpilePackages: [
    "@rakku/emails",
    "@rakku/ledger",
    "@rakku/pricing",
    "@rakku/shared-types",
    "@rakku/db",
    "@rakku/ui",
  ],
};

export default nextConfig;
