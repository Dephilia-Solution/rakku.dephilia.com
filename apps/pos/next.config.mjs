import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import withSerwistInit from "@serwist/next";

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

const require = createRequire(import.meta.url);
let esbuildPromise;
function getEsbuild() {
  if (!esbuildPromise) {
    const esbuildPath = require.resolve("esbuild", {
      paths: [require.resolve("@serwist/next/package.json")],
    });
    esbuildPromise = import(pathToFileURL(esbuildPath).href).then((m) => m.default);
  }
  return esbuildPromise;
}

const withSerwist = withSerwistInit({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const SW_ASSET_REGEX = /(^|\/)sw\.js$/;
const MODERN_SYNTAX_REGEX = /\?\?=?|\|\|=\??|&&=\??|\?\.(?:[a-zA-Z_$])/;

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/categories", destination: "/products", permanent: false },
      { source: "/pricing-tiers", destination: "/products", permanent: false },
      { source: "/taxes", destination: "/tax-discounts?tab=pajak", permanent: false },
      { source: "/discounts", destination: "/tax-discounts?tab=produk", permanent: false },
    ];
  },
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
    "@serwist/next",
    "serwist",
  ],
  webpack(config, options) {
    if (!options.isServer && !options.dev) {
      const { Compilation, sources } = options.webpack;
      config.plugins.push({
        apply(compiler) {
          compiler.hooks.thisCompilation.tap("DownlevelSerwistSW", (compilation) => {
            compilation.hooks.processAssets.tapPromise(
              {
                name: "DownlevelSerwistSW",
                stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER + 100,
              },
              async () => {
                const targets = compilation
                  .getAssets()
                  .filter(
                    (a) =>
                      a.name.endsWith(".js") &&
                      !a.name.endsWith(".map") &&
                      (SW_ASSET_REGEX.test(a.name) ||
                        a.name.startsWith("static/chunks/") ||
                        a.name.startsWith("static/runtime/")),
                  );
                if (targets.length === 0) return;
                const esbuild = await getEsbuild();
                let transformed = 0;
                for (const asset of targets) {
                  const code = asset.source.source().toString();
                  if (!MODERN_SYNTAX_REGEX.test(code)) continue;
                  try {
                    const result = await esbuild.transform(code, {
                      target: "es2017",
                      minify: true,
                      loader: "js",
                    });
                    compilation.updateAsset(
                      asset.name,
                      new sources.RawSource(result.code),
                    );
                    transformed++;
                  } catch (err) {
                    compilation.errors.push(err);
                  }
                }
                if (transformed > 0) {
                  console.log(
                    `[DownlevelSerwistSW] Down-leveled ${transformed} asset(s) to es2017 for legacy Android WebView.`,
                  );
                }
              },
            );
          });
        },
      });
    }
    return config;
  },
};

export default withSerwist(nextConfig);
