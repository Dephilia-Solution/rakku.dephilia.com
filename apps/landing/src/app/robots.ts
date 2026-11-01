import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", ...(isIndexable ? { allow: "/", disallow: "/api/" } : { disallow: "/" }) },
    ...(isIndexable ? { sitemap: `${siteUrl}/sitemap.xml`, host: siteUrl } : {}),
  };
}
