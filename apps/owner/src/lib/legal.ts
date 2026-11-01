import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type LegalSlug = "terms" | "privacy";

const FILES: Record<LegalSlug, string> = {
  terms: "syarat-dan-ketentuan.md",
  privacy: "kebijakan-privasi.md",
};

export const LEGAL_TITLES: Record<LegalSlug, string> = {
  terms: "Syarat dan Ketentuan Layanan",
  privacy: "Kebijakan Privasi",
};

export async function readLegalDocument(slug: LegalSlug): Promise<string> {
  const file = FILES[slug];
  const candidates = [
    join(process.cwd(), "content", "legal", file),
    join(process.cwd(), "apps", "owner", "content", "legal", file),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error(`Dokumen legal tidak ditemukan: ${file}`);
  return readFile(path, "utf8");
}
