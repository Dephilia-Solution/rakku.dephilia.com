import { ArrowRightIcon } from "./icons";
import { ButtonLink } from "./motion";
import { Container } from "./primitives";
import { ownerUrl, posUrl } from "./site";
import { ScrollReveal } from "./scroll-reveal";

export function FinalCta() {
  return (
    <ScrollReveal className="bg-paper py-[clamp(4.5rem,8vw,7rem)]">
      <Container>
        <div className="grid gap-10 bg-green-950 px-6 py-10 text-ivory sm:px-10 sm:py-12 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16 lg:px-14 lg:py-14">
          <div>
            <span className="text-sm font-semibold tracking-[0.12em] text-lime">RAKKU</span>
            <h2 className="mt-5 max-w-[10ch] text-balance font-display text-[clamp(2.8rem,5vw,4.6rem)] font-bold leading-[0.95] tracking-[-0.07em] text-ivory">Operasional lebih terbaca.</h2>
            <p className="mt-5 max-w-[24rem] text-sm leading-[1.65] text-ivory/65">Mulai dengan satu outlet, lalu biarkan sistem mengikuti cara bisnis Anda berkembang.</p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row lg:flex-col lg:items-stretch">
            <ButtonLink href={`${ownerUrl}/register`} className="min-h-[3.25rem] bg-lime px-6 text-green-950 hover:bg-[#e0ee94]">
              Mulai gratis <ArrowRightIcon className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href={`${posUrl}/login`} className="min-h-[3.25rem] border border-ivory/30 px-6 text-ivory hover:border-lime hover:text-lime">
              Buka POS kasir
            </ButtonLink>
          </div>
        </div>
      </Container>
    </ScrollReveal>
  );
}
