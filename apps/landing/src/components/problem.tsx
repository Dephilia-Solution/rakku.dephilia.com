import { Container } from "./primitives";
import { ArrowRightIcon } from "./icons";
import { InteractiveRow } from "./motion";
import { ScrollReveal } from "./scroll-reveal";

const trace = [
  ["01", "Omzet?", "Lihat penjualan dan tren dari transaksi yang sudah selesai."],
  ["02", "Laku?", "Kenali menu favorit restomu dari jumlah yang terjual."],
  ["03", "Stok?", "Cek bahan yang mencapai stok minimum sebelum waktunya restock."],
] as const;

export function Problem() {
  return (
    <ScrollReveal className="bg-paper-deep py-[clamp(4.5rem,8vw,7rem)]" id="kenapa-rakku">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-[clamp(4rem,9vw,9rem)]">
          <div>
            <h2 className="max-w-[13ch] text-balance font-display text-[clamp(2.8rem,5vw,4.7rem)] font-bold leading-[0.95] tracking-[-0.07em] text-green-950">
              Pesanan rame.
              <br />
              Datanya bikin bingung?
            </h2>
            <p className="mt-6 max-w-[28rem] text-[0.95rem] leading-[1.7] text-muted">Pas kedai tutup, kamu masih perlu tahu jualan berapa, menu apa yang laku, dan bahan yang mau abis. Kalau masih ngecek satu-satu, capek, kan?</p>
          </div>

          <ol className="border-t border-green-950/15">
            {trace.map(([number, title, description]) => (
              <li key={number} className="border-b border-green-950/15">
                <InteractiveRow className="group grid gap-4 py-6 sm:grid-cols-[3rem_8rem_minmax(0,1fr)_1.25rem] sm:items-start sm:gap-6">
                  <span className="font-mono text-[0.65rem] font-semibold text-green-700/55 transition-opacity duration-200 group-hover:text-green-700 group-hover:opacity-100">{number}</span>
                  <h3 className="m-0 font-display text-[1.35rem] font-bold tracking-[-0.04em] text-green-950 transition-transform duration-200 group-hover:translate-x-1">{title}</h3>
                  <p className="m-0 max-w-[23rem] text-sm leading-[1.6] text-muted">{description}</p>
                  <ArrowRightIcon className="mt-1 hidden h-4 w-4 text-green-700 opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:block" />
                </InteractiveRow>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </ScrollReveal>
  );
}
