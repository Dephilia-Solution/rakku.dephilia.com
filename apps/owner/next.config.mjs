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
    "@rakku/shared-types",
    "@rakku/supabase-clients",
    "@rakku/auth-utils",
    "@rakku/ui",
    "@rakku/pricing",
  ],
};

export default nextConfig;
