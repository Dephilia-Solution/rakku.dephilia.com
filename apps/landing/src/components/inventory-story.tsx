import { ArrowRightIcon } from "./icons";
import { Lift, Stagger, StaggerItem } from "./motion";
import { SectionKicker, TextLink } from "./primitives";
import { RecipeBoard } from "./recipe-board";
import { ScrollReveal } from "./scroll-reveal";

export function InventoryStory() {
  return (
    <ScrollReveal className="bg-green-800 py-[clamp(3.5rem,6vw,5.5rem)] text-ivory" id="inventory">
      <Stagger className="landing-container grid items-center gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-[clamp(2.5rem,6vw,4.5rem)]">
        <StaggerItem>
          <SectionKicker light>04 / Dari resep ke stok</SectionKicker>
          <h2 className="font-display text-[clamp(2.45rem,4.5vw,4.05rem)] font-semibold leading-[1.02] text-ivory">
            Satu gelas kopi.
            <br />
            <em className="not-italic text-lime">Jejaknya jelas.</em>
          </h2>
          <p className="mt-5 max-w-[24.375rem] text-[0.9375rem] leading-[1.65] text-ivory/70">Rakku menggunakan resep yang sama untuk menghitung pemakaian bahan, HPP, dan peringatan stok. Tidak ada mekanisme terpisah untuk produk jadi atau resale.</p>
          <TextLink href="#fitur" light>
            Lihat fitur inventory <ArrowRightIcon className="h-4 w-4" />
          </TextLink>
        </StaggerItem>
        <StaggerItem>
          <Lift>
            <RecipeBoard />
          </Lift>
        </StaggerItem>
      </Stagger>
    </ScrollReveal>
  );
}
