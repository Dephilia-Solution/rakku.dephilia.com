import { Container } from "./primitives";

const areas = ["Kasir", "Resep", "Stok", "Outlet", "Laba"];

export function SignalStrip() {
  return (
    <section className="border-y border-ivory/10 bg-green-950 text-ivory" aria-label="Area kerja Rakku">
      <Container className="flex min-h-[4.5rem] flex-col justify-center gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-0">
        <span className="text-xs font-medium text-ivory/55">Satu alur kerja untuk</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-base font-bold text-lime sm:gap-x-4 sm:text-lg">
          {areas.map((area, index) => (
            <span key={area} className="inline-flex items-center gap-3">
              {index > 0 ? <span className="h-1 w-1 rounded-full bg-lime/50" aria-hidden="true" /> : null}
              {area}
            </span>
          ))}
        </div>
        <span className="text-xs font-medium text-ivory/55 sm:text-right">Satu jejak data.</span>
      </Container>
    </section>
  );
}
