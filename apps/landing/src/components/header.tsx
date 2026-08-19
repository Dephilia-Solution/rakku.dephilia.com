import Image from "next/image";

import { ArrowRightIcon } from "./icons";
import { MobileMenu } from "./mobile-menu";
import { ButtonLink } from "./motion";
import { Container } from "./primitives";
import { ownerUrl } from "./site";

const links = [
  ["Fitur", "#fitur"],
  ["Cara kerja", "#alur"],
  ["Untuk siapa", "#untuk-siapa"],
  ["FAQ", "#faq"],
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-brand bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <Container className="relative flex min-h-[4.75rem] items-center justify-between gap-4">
        <a href="#top" className="flex shrink-0 items-center gap-2.5" aria-label="Rakku, kembali ke atas">
          <Image src="/images/rakku_logotype.png" alt="Rakku" width={85} height={10} className="w-[clamp(5.9rem,10vw,7.25rem)] object-contain" priority />
        </a>

        <nav className="ml-auto hidden items-center gap-6 text-[0.8125rem] font-semibold text-muted md:flex" aria-label="Navigasi utama">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="landing-link-underline flex min-h-12 items-center transition-colors duration-200 hover:text-green-800">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-5">
          <a href={`${ownerUrl}/login`} className="landing-link-underline hidden min-h-12 items-center text-[0.8125rem] font-bold text-green-800 transition-colors duration-200 hover:text-green-950 sm:inline-flex">
            Masuk
          </a>
          <ButtonLink href={`${ownerUrl}/register`} className="min-h-11 bg-green-950 px-3.5 text-[0.7rem] text-ivory shadow-sm hover:bg-green-800 hover:shadow-lg sm:px-4 sm:text-[0.8125rem]">
            Mulai gratis <ArrowRightIcon className="h-4 w-4" />
          </ButtonLink>
          <MobileMenu links={links} ownerUrl={ownerUrl} />
        </div>
      </Container>
    </header>
  );
}
