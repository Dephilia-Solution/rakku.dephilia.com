import Image from "next/image";

import { Container } from "./primitives";
import { ownerUrl, posUrl } from "./site";

type FooterGroupProps = {
  label: string;
  links: string[][];
};

export function Footer() {
  return (
    <footer className="bg-green-950 pb-[env(safe-area-inset-bottom)] text-ivory/70">
      <Container className="flex flex-col justify-between gap-10 py-10 lg:flex-row lg:gap-20">
        <div>
          <a href="#top" className="flex items-center gap-2.5 text-ivory" aria-label="Rakku, kembali ke atas">
            <Image src="/images/rakku_logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <span className="font-display text-[1.7rem]">rakku</span>
          </a>
          <p className="mt-4 max-w-[11.25rem] text-xs text-ivory/50">Sistem operasional untuk kedai &amp; cafe.</p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-16">
          <FooterGroup
            label="Produk"
            links={[
              ["Fitur", "#fitur"],
              ["Cara kerja", "#alur"],
              ["FAQ", "#faq"],
            ]}
          />
          <FooterGroup
            label="Akses"
            links={[
              ["Portal Owner", `${ownerUrl}/login`],
              ["POS Kasir", `${posUrl}/login`],
            ]}
          />
          <FooterGroup
            label="Dokumen"
            links={[
              ["Bantuan", "#faq"],
              ["Privasi", "#faq"],
            ]}
          />
        </div>
      </Container>

      <Container className="flex flex-col gap-3 border-t border-ivory/15 py-4 font-mono text-[0.5rem] text-ivory/40 sm:flex-row sm:justify-between sm:py-5">
        <span>© 2026 Rakku.</span>
      </Container>
    </footer>
  );
}

function FooterGroup({ label, links }: FooterGroupProps) {
  return (
    <div className="flex min-w-[5.6rem] flex-col items-start gap-2">
      <span className="mb-2 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-lime">{label}</span>
      {links.map(([text, href]) => (
        <a key={text} href={href} className="landing-link-underline text-xs transition-colors duration-200 hover:text-lime">
          {text}
        </a>
      ))}
    </div>
  );
}
