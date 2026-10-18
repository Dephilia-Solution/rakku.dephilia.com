/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.RAKKU_ISOLATED_BUILD === "1" ? process.env.RAKKU_BUILD_DIRECTORY || ".next-hardening" : ".next",
  experimental: { cpus: 2 },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@rakku/ui"],
};

export default nextConfig;
