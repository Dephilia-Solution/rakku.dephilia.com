import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const preview = process.env.VERCEL_ENV === "preview";
  return {
    rules: { userAgent: "*", ...(preview ? { disallow: "/" } : { allow: "/", disallow: "/api/" }) },
    ...(isIndexable ? { sitemap: `${siteUrl}/sitemap.xml`, host: siteUrl } : {}),
  };
}
