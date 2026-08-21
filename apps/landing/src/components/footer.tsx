import Image from "next/image";

import { Container } from "./primitives";

type FooterGroupProps = {
  label: string;
  links: Array<readonly [string, string | null]>;
};

export function Footer() {
  return (
    <footer className="bg-green-950 pb-[env(safe-area-inset-bottom)] text-ivory/70">
      <Container className="flex flex-col justify-between gap-10 py-10 lg:flex-row lg:gap-20">
        <div>
          <a href="#top" className="inline-flex items-center" aria-label="Rakku, kembali ke atas">
            <Image src="/images/rakku_logotype.png" alt="Rakku" width={171} height={24} className="h-auto w-[8.5rem] brightness-0 invert" />
          </a>
          <p className="mt-4 max-w-[15rem] text-xs leading-[1.6] text-ivory/50">Software operasional untuk bisnis yang ingin lebih rapi.</p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-16">
          <FooterGroup
            label="Produk"
            links={[
              ["Kasir", "#kasir"],
              ["Resep", "#resep"],
              ["Stok", "#stok"],
              ["Outlet", "#outlet"],
            ]}
          />
          <FooterGroup
            label="Perusahaan"
            links={[
              ["Cara kerja", "#alur"],
              ["Tentang Rakku", null],
            ]}
          />
          <FooterGroup label="Bantuan" links={[["Panduan", null], ["Kontak", null]]} />
        </div>
      </Container>

      <Container className="flex flex-col gap-3 border-t border-ivory/15 py-4 font-mono text-[0.5rem] text-ivory/40 sm:flex-row sm:justify-between sm:py-5">
        <span>© 2026 Rakku.</span>
        <span>Kasir · Resep · Stok · Outlet · Laba</span>
      </Container>
    </footer>
  );
}

function FooterGroup({ label, links }: FooterGroupProps) {
  return (
    <div className="flex min-w-[5.6rem] flex-col items-start gap-2">
      <span className="mb-2 font-mono text-[0.65rem] font-semibold text-lime">{label}</span>
      {links.map(([text, href]) => (
        href ? (
          <a key={text} href={href} className="landing-link-underline text-xs transition-colors duration-200 hover:text-lime">
            {text}
          </a>
        ) : (
          <span key={text} className="cursor-default text-xs text-ivory/30" aria-disabled="true">
            {text}
          </span>
        )
      ))}
    </div>
  );
}
