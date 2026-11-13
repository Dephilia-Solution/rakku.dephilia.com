import { questions } from "@/content/faq";
import { shouldIndexSite } from "./indexing";

export { shouldIndexSite } from "./indexing";

// Keep discovery URLs stable across the custom domain and Vercel aliases.
export const siteUrl = new URL(process.env.SITE_URL || "https://rakku.dephilia.com").origin;
export const isIndexable = shouldIndexSite(process.env.VERCEL_ENV, process.env.SITE_INDEXABLE);
export const siteTitle = "Rakku POS | Kasir, Stok & Laporan untuk Cafe dan Resto";
export const siteDescription = "Kasir, stok, dan laporan dalam satu tempat. Atur menu dan resep, catat pemakaian bahan otomatis, lalu baca omzet dan menu favorit restomu. Mulai gratis.";

export function homeStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Rakku",
        url: siteUrl,
        logo: `${siteUrl}/images/rakku_logo.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Rakku",
        url: siteUrl,
        inLanguage: "id-ID",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}/#application`,
        name: "Rakku",
        url: siteUrl,
        description: siteDescription,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web browser",
        inLanguage: "id-ID",
        publisher: { "@id": `${siteUrl}/#organization` },
        featureList: ["Kasir POS", "Resep produk", "Stok bahan baku", "Multi-outlet", "Laporan laba rugi", "Menu QR"],
        offers: {
          "@type": "Offer",
          name: "Rakku Free",
          price: 0,
          priceCurrency: "IDR",
          url: `${siteUrl}/#harga`,
          description: "Paket gratis untuk 1 outlet, 2 karyawan, 30 produk, dan 500 transaksi per bulan.",
        },
      },
      {
        "@type": ["WebPage", "FAQPage"],
        "@id": `${siteUrl}/#webpage`,
        url: `${siteUrl}/`,
        name: siteTitle,
        description: siteDescription,
        inLanguage: "id-ID",
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: { "@id": `${siteUrl}/#application` },
        mainEntity: questions.map(([name, text]) => ({
          "@type": "Question",
          name,
          acceptedAnswer: { "@type": "Answer", text },
        })),
      },
    ],
  };
}
