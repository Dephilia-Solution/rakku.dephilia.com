import { ArrowRightIcon } from "./icons";
import { Container, TextLink } from "./primitives";
import { RecipeBoard } from "./recipe-board";
import { ScrollReveal } from "./scroll-reveal";

export function InventoryStory() {
  return (
    <ScrollReveal className="bg-green-800 py-[clamp(4.5rem,8vw,7rem)] text-ivory" id="stok">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-[clamp(3rem,7vw,7rem)]">
          <div>
            <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-lime">Contoh alur produk</span>
            <h2 className="mt-5 max-w-[10ch] text-balance font-display text-[clamp(2.65rem,5vw,4.5rem)] font-bold leading-[0.97] tracking-[-0.07em] text-ivory">Resep yang sama menghubungkan kasir dan stok.</h2>
            <p className="mt-6 max-w-[25rem] text-[0.95rem] leading-[1.7] text-ivory/70">Satu konfigurasi produk membantu tim menjual lebih cepat dan owner membaca pemakaian bahan dengan konteks yang sama.</p>
            <TextLink href="#alur" light>
              Lihat cara kerja <ArrowRightIcon className="h-4 w-4" />
            </TextLink>
          </div>
          <div className="min-w-0">
            <RecipeBoard />
          </div>
        </div>
      </Container>
    </ScrollReveal>
  );
}
