import { Stagger, StaggerItem } from "./motion";
import { SectionKicker } from "./primitives";
import { ScrollReveal } from "./scroll-reveal";

const points = [
  "Owner melihat apa yang terjadi di tiap outlet, tanpa harus selalu berada di sana.",
  "Kasir bekerja cepat dengan POS yang fokus pada pesanan, meja, dan pembayaran.",
  "Stok dan HPP mengikuti resep, bukan perkiraan di akhir bulan.",
];

export function Problem() {
  return (
    <ScrollReveal className="bg-paper py-[clamp(3.5rem,6vw,5.5rem)]" id="kenapa-rakku">
      <Stagger className="landing-container grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-[clamp(3rem,7vw,5.5rem)]">
        <StaggerItem>
          <SectionKicker>01 / Kenapa Rakku</SectionKicker>
          <h2 className="max-w-[12ch] font-display text-[clamp(2.45rem,4.5vw,4.05rem)] font-semibold leading-[1.02] text-green-950">Bisnis Anda bergerak cepat. Sistemnya harus ikut.</h2>
        </StaggerItem>

        <StaggerItem className="pt-0 lg:pt-8">
          <p className="max-w-[37.5rem] font-display text-[clamp(1.35rem,2.2vw,1.6rem)] leading-[1.25] tracking-[-0.025em] text-green-900">
            Kedai tidak butuh software yang terasa seperti ERP. Anda butuh satu tempat yang mengerti ritme buka toko, antrean kasir, bahan yang berkurang, dan keputusan yang harus dibuat sebelum jam ramai.
          </p>
          <div className="mt-9 grid gap-4">
            {points.map((point, index) => (
              <div key={point} className="grid grid-cols-[2.6rem_1fr] gap-3 border-t border-brand pt-4">
                <span className="font-mono text-[0.65rem] text-coral">0{index + 1}</span>
                <p className="m-0 max-w-[26.875rem] text-sm leading-[1.6] text-muted">{point}</p>
              </div>
            ))}
          </div>
        </StaggerItem>
      </Stagger>
    </ScrollReveal>
  );
}
