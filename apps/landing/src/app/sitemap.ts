import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  // Anchors are sections of the homepage, not separate indexable URLs.
  return isIndexable ? [{ url: `${siteUrl}/` }] : [];
}
