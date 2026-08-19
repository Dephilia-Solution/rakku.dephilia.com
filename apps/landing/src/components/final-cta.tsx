import { ArrowRightIcon } from "./icons";
import { ButtonLink } from "./motion";
import { Container, SectionKicker } from "./primitives";
import { ownerUrl, posUrl } from "./site";
import { ScrollReveal } from "./scroll-reveal";

export function FinalCta() {
  return (
    <ScrollReveal className="bg-paper py-[clamp(3.5rem,6vw,5.5rem)]">
      <Container>
        <div className="relative flex min-h-[20rem] flex-col justify-between gap-8 overflow-hidden rounded-lg bg-green-950 px-6 py-8 text-ivory sm:px-12 lg:flex-row lg:items-center lg:gap-14 lg:px-[4.7rem]">
          <div className="animate-cta-orbit pointer-events-none absolute -bottom-40 -right-24 h-[27.5rem] w-[27.5rem] origin-center rounded-full border border-lime/25 shadow-[0_0_0_35px_rgba(211,230,109,0.06),0_0_0_70px_rgba(211,230,109,0.04)]" />
          <div className="absolute right-7 top-6 grid h-12 w-12 rotate-12 place-items-center rounded-full border border-lime/50 font-display text-3xl text-lime" aria-hidden="true">
            R
          </div>

          <div className="relative z-10">
            <SectionKicker light>Mulai dari sini</SectionKicker>
            <h2 className="font-display text-[clamp(2.9rem,5vw,4.5rem)] font-semibold leading-[0.95] text-ivory">
              Rapi dulu.
              <br />
              <em className="not-italic text-lime">Tumbuh kemudian.</em>
            </h2>
            <p className="mt-4 max-w-[22.5rem] text-sm text-ivory/65">Bangun fondasi operasional yang bisa mengikuti cara bisnis Anda berkembang.</p>
          </div>

          <div className="relative z-10 flex min-w-[11.875rem] flex-col gap-2.5">
            <ButtonLink href={`${ownerUrl}/register`} className="min-h-[3.375rem] bg-lime text-green-950 hover:bg-[#e0ee94]">
              Mulai gratis <ArrowRightIcon className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href={`${posUrl}/login`} className="min-h-[3.375rem] border border-ivory/30 text-ivory hover:border-lime hover:text-lime">
              Buka POS Kasir
            </ButtonLink>
          </div>
        </div>
      </Container>
    </ScrollReveal>
  );
}
