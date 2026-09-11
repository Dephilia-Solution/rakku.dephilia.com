/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  transpilePackages: [
    "@rakku/emails",
    "@rakku/ledger",
    "@rakku/pricing",
    "@rakku/shared-types",
    "@rakku/supabase-clients",
    "@rakku/ui",
  ],
};

export default nextConfig;
