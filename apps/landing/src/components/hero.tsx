import { ArrowDownIcon, ArrowRightIcon } from "./icons";
import { HeroProductMenu } from "./hero-product-menu";
import { ButtonLink, HeroCopy, HeroVisual } from "./motion";
import { Container } from "./primitives";
import { ownerUrl } from "./site";

export function HeroPreview() {
  return <HeroProductMenu />;
}

export function Hero() {
  return (
    <section id="top" className="overflow-hidden bg-paper pb-[clamp(4.5rem,8vw,7rem)] pt-[clamp(2.5rem,6vw,5rem)] lg:min-h-[calc(100dvh-4.75rem)] lg:py-[clamp(3.5rem,6vw,5.5rem)]">
      <Container className="grid items-center gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-[clamp(3.5rem,7vw,7rem)]">
        <HeroCopy className="relative z-10">
          <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-green-700">Operasional · POS</div>
          <h1 className="max-w-[10ch] text-balance font-display text-[clamp(3.25rem,5.6vw,5.25rem)] font-bold leading-[0.94] tracking-[-0.075em] text-green-950">
            Kasir beres,
            <br />
            <span className="text-green-700">Laba terbaca.</span>
          </h1>
          <p className="max-w-[30rem] text-balance text-[clamp(1rem,1.6vw,1.15rem)] leading-[1.65] text-muted">
            Rakku menghubungkan kasir, resep, stok, dan laporan dalam satu alur kerja.
          </p>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <ButtonLink href={`${ownerUrl}/register`} className="min-h-[3.25rem] bg-green-800 px-6 text-ivory shadow-[0_12px_26px_rgba(29,91,56,0.18)] hover:bg-green-950">
              Mulai gratis <ArrowRightIcon className="h-4 w-4" />
            </ButtonLink>
            <a href="#alur" className="landing-link-underline inline-flex min-h-12 items-center gap-2 px-1 text-[0.8125rem] font-bold text-green-800 hover:text-green-950">
              Lihat cara kerja <ArrowDownIcon className="h-4 w-4" />
            </a>
          </div>
        </HeroCopy>

        <HeroVisual className="min-w-0">
          <HeroPreview />
        </HeroVisual>
      </Container>
    </section>
  );
}
