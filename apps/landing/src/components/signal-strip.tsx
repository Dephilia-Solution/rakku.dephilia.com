import { Container } from "./primitives";

const areas = ["Kasir", "Stok", "Resep", "Outlet", "Laba"];

export function SignalStrip() {
  return (
    <section className="border-y border-green-950/10 bg-green-950 text-ivory" aria-label="Area kerja Rakku">
      <Container className="flex min-h-[4.25rem] flex-col items-start justify-center gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:py-0">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.07em] text-ivory/60">Satu alur kerja untuk</span>
        <div className="flex items-center gap-3 font-display text-base text-lime sm:gap-3.5 sm:text-lg">
          {areas.map((area, index) => (
            <span key={area} className="contents">
              {index > 0 ? <i className="h-1 w-1 rounded-full bg-coral" /> : null}
              <span>{area}</span>
            </span>
          ))}
        </div>
        <span className="hidden text-right font-mono text-[0.6rem] uppercase tracking-[0.07em] text-ivory/60 sm:block">bukan lima spreadsheet terpisah.</span>
      </Container>
    </section>
  );
}
