import Image from "next/image";

import { ArrowRightIcon } from "./icons";
import { MobileMenu } from "./mobile-menu";
import { ButtonLink, HeaderFrame, MotionLink } from "./motion";
import { Container } from "./primitives";
import { ownerUrl } from "./site";

const links = [
  ["Kasir", "#kasir"],
  ["Resep", "#resep"],
  ["Stok", "#stok"],
  ["Outlet", "#outlet"],
  ["Laba", "#laba"],
] as const;

export function Header() {
  return (
    <HeaderFrame>
      <Container className="relative flex min-h-[4.75rem] items-center justify-between gap-4">
          <MotionLink href="#top" className="flex shrink-0 items-center gap-2.5" aria-label="Rakku, kembali ke atas">
            <Image src="/images/rakku_logotype.png" alt="Rakku" width={85} height={10} className="w-[clamp(5.9rem,10vw,7.25rem)] object-contain" priority />
          </MotionLink>

        <nav className="ml-auto hidden items-center gap-[clamp(1rem,2.2vw,1.75rem)] text-[0.8125rem] font-semibold text-muted lg:flex" aria-label="Navigasi utama">
          {links.map(([label, href]) => (
            <MotionLink key={href} href={href} className="landing-link-underline flex min-h-12 items-center transition-colors duration-200 hover:text-green-800">
              {label}
            </MotionLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-5">
          <MotionLink href={`${ownerUrl}/login`} className="landing-link-underline hidden min-h-12 items-center text-[0.8125rem] font-bold text-green-800 transition-colors duration-200 hover:text-green-950 lg:inline-flex">
            Masuk
          </MotionLink>
          <ButtonLink href={`${ownerUrl}/register`} className="min-h-12 bg-green-950 px-3.5 text-[0.7rem] text-ivory shadow-sm hover:bg-green-800 hover:shadow-lg sm:px-4 sm:text-[0.8125rem]">
            Mulai gratis <ArrowRightIcon className="h-4 w-4" />
          </ButtonLink>
          <MobileMenu links={links} ownerUrl={ownerUrl} />
        </div>
      </Container>
    </HeaderFrame>
  );
}
