import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { readLegalDocument } from "@/lib/legal";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — Rakku POS",
  description: "Kebijakan Privasi Rakku POS mengenai pemrosesan dan pelindungan Data Pribadi.",
};

export default async function PrivacyPage() {
  const markdown = await readLegalDocument("privacy");
  return <LegalDocument slug="privacy" markdown={markdown} />;
}
