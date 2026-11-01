import { LandingPage } from "@/components";
import type { Metadata } from "next";
import { homeStructuredData, siteUrl } from "@/lib/seo";

export const metadata: Metadata = { alternates: { canonical: `${siteUrl}/` } };

export default function HomePage() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeStructuredData()).replace(/</g, "\\u003c") }} />
    <LandingPage />
  </>;
}
