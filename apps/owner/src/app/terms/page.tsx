import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { readLegalDocument } from "@/lib/legal";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Syarat dan Ketentuan Layanan — Rakku POS",
  description: "Syarat dan Ketentuan Layanan Rakku POS untuk Merchant, Owner, dan Pengguna Terotorisasi.",
};

export default async function TermsPage() {
  const markdown = await readLegalDocument("terms");
  return <LegalDocument slug="terms" markdown={markdown} />;
}
