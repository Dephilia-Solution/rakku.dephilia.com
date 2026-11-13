/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.RAKKU_ISOLATED_BUILD === "1" ? process.env.RAKKU_BUILD_DIRECTORY || ".next-hardening" : ".next",
  experimental: { cpus: 2 },
  // Filesystem pack serialization can allocate large native buffers even when
  // V8's heap is small. Keep dev cache bounded/in-memory on constrained hosts.
  // Do not add a custom Webpack hook to production (preserves its build worker).
  ...(process.env.NODE_ENV === "development" && process.env.RAKKU_SUPERADMIN_DISK_CACHE !== "1" ? {
    webpack(config) {
      config.cache = { type: "memory", maxGenerations: 1 };
      return config;
    },
  } : {}),
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
