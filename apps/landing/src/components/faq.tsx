import { questions } from "@/content/faq";
import { PlusIcon } from "./icons";
import { Container } from "./primitives";
import { ScrollReveal } from "./scroll-reveal";

export function FAQ() {
  return (
    <ScrollReveal className="bg-paper-deep py-[clamp(4.5rem,8vw,7rem)]" id="faq">
      <Container className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-[clamp(4rem,9vw,8rem)]">
        <div>
          <h2 className="max-w-[10ch] text-balance font-display text-[clamp(2.65rem,5vw,4.5rem)] font-bold leading-[0.97] tracking-[-0.07em] text-green-950">Yang perlu diketahui sebelum mulai.</h2>
          <p className="mt-6 max-w-[22rem] text-[0.95rem] leading-[1.7] text-muted">Jawaban singkat untuk alur kerja Rakku saat ini.</p>
        </div>
        <div className="border-t border-green-950/15">
          {questions.map(([question, answer], index) => (
            <details key={question} name="rakku-faq" open={index === 0} className="landing-faq group border-b border-green-950/15">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-left font-display text-[clamp(1.1rem,2vw,1.35rem)] font-bold leading-[1.15] tracking-[-0.04em] text-green-950 transition-colors hover:text-green-700 [&::-webkit-details-marker]:hidden">
                <span>{question}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-green-800/20 text-green-700 transition-transform group-open:rotate-45" aria-hidden="true">
                  <PlusIcon className="h-4 w-4" />
                </span>
              </summary>
              <p className="landing-faq-answer mb-5 max-w-[39rem] pr-10 text-sm leading-[1.65] text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </ScrollReveal>
  );
}
