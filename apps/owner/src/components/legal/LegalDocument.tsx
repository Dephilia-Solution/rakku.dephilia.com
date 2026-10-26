import Image from "next/image";
import Link from "next/link";
import type { LegalSlug } from "@/lib/legal";
import { LEGAL_TITLES } from "@/lib/legal";
import MarkdownDocument, { buildHeadings } from "./MarkdownDocument";
import TocNav from "./TocNav";

const OTHER: Record<LegalSlug, LegalSlug> = { terms: "privacy", privacy: "terms" };
const HREF: Record<LegalSlug, string> = { terms: "/terms", privacy: "/privacy" };

export default function LegalDocument({ slug, markdown }: { slug: LegalSlug; markdown: string }) {
  const sections = buildHeadings(markdown)
    .filter((heading) => heading.level === 2)
    .map(({ title, id }) => ({ title, id }));
  const other = OTHER[slug];

  return (
    <div className="min-h-dvh bg-cream text-ink">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Rakku">
            <Image src="/images/rakku_logo.png" alt="" width={32} height={32} priority className="h-8 w-8 object-contain" />
            <Image src="/images/rakku_logotype.png" alt="Rakku" width={100} height={26} priority className="hidden h-[22px] w-auto sm:block" />
          </Link>
          <nav className="flex items-center gap-1.5 text-[12.5px] font-semibold" aria-label="Navigasi akun">
            <Link href="/register" aria-label="Kembali ke pendaftaran" className="rounded-lg px-2.5 py-2 text-leaf transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf">
              <span className="sm:hidden">Kembali</span>
              <span className="hidden sm:inline">Kembali ke pendaftaran</span>
            </Link>
            <Link href="/login" className="rounded-lg border border-line bg-white px-3 py-2 text-ink transition-colors hover:border-leaf/40 hover:text-leaf focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf">
              Masuk
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:py-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <p className="inline-flex items-center gap-2 rounded-full border border-leaf/20 bg-leaf/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-leaf">
            Dokumen Hukum · Rakku POS
          </p>
          <nav aria-label="Dokumen hukum" className="inline-flex w-full max-w-md flex-col gap-0.5 rounded-xl border border-line bg-white p-1 shadow-sm sm:w-auto sm:flex-row sm:max-w-none">
            {(Object.keys(HREF) as LegalSlug[]).map((item) => (
              <Link
                key={item}
                href={HREF[item]}
                aria-current={item === slug ? "page" : undefined}
                className={`rounded-lg px-3.5 py-2 text-center text-[12.5px] font-semibold transition-colors sm:py-1.5 ${
                  item === slug
                    ? "bg-leaf text-white shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                {LEGAL_TITLES[item]}
              </Link>
            ))}
          </nav>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
          <details suppressHydrationWarning className="rounded-2xl border border-line bg-white p-2 shadow-sm lg:hidden print:hidden">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf">
              Daftar isi
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{sections.length} bagian</span>
            </summary>
            <div className="mt-1 max-h-[60dvh] overflow-y-auto px-1 pb-1 pt-1 scrollbar-none">
              <TocNav items={sections} />
            </div>
          </details>

          <aside className="hidden self-stretch lg:block print:hidden">
            <div className="sticky top-20 flex max-h-[calc(100dvh-6rem)] flex-col rounded-2xl border border-line bg-white shadow-sm">
              <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Daftar isi</p>
                <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-muted">{sections.length} bagian</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3 pt-1 scrollbar-none">
                <TocNav items={sections} />
              </div>
            </div>
          </aside>

          <article
            id="legal-content"
            aria-label={LEGAL_TITLES[slug]}
            className="min-w-0 scroll-mt-24 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-8 lg:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none"
          >
            <div className="mb-6 flex flex-wrap items-center gap-2 text-[11px] text-muted print:hidden">
              <span className="rounded-full border border-line bg-cream px-2.5 py-1 font-semibold text-ink">Rakku POS</span>
              <span>Berlaku untuk Merchant, Owner, dan Pengguna Terotorisasi.</span>
            </div>

            <MarkdownDocument source={markdown} />

            <div className="mt-10 border-t border-line pt-6 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Baca juga</p>
                  <Link href={HREF[other]} className="mt-1 inline-flex text-sm font-semibold text-leaf underline decoration-leaf/30 underline-offset-4 hover:decoration-leaf">
                    {LEGAL_TITLES[other]}
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href="#legal-content" className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-muted transition-colors hover:text-leaf">
                    Kembali ke atas
                  </a>
                  <Link href="/register" className="rounded-lg bg-leaf px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-leaf-dark">
                    Kembali ke pendaftaran
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>

      <footer className="border-t border-line/80 px-4 py-6 text-center text-xs text-muted print:hidden">
        <p>© 2026 Rakku POS · Dokumen hukum ditampilkan dari sumber Markdown resmi aplikasi.</p>
      </footer>
    </div>
  );
}
