import { CashierFeaturePreview, OwnerFeaturePreview, RecipeFeaturePreview } from "./feature-previews";
import { Stagger, StaggerItem } from "./motion";
import { Container } from "./primitives";
import { ScrollReveal } from "./scroll-reveal";

const features = [
  {
    number: "01",
    label: "Kasir",
    title: "Kasir yang mengikuti ritme antrean.",
    description: "Produk, modifier, meja, pembayaran, dan invoice berada di satu alur yang singkat.",
    items: ["Dine in & take away", "QRIS & tunai", "Split bill"],
    preview: <CashierFeaturePreview />,
  },
  {
    number: "02",
    label: "Resep",
    title: "Resep membuat stok lebih masuk akal.",
    description: "Hubungkan produk dengan bahan baku. Setiap order selesai meninggalkan catatan pemakaian.",
    items: ["Resep per produk", "Stock movement", "Peringatan stok"],
    preview: <RecipeFeaturePreview />,
  },
  {
    number: "03",
    label: "Owner",
    title: "Owner melihat yang perlu diputuskan.",
    description: "Omzet, HPP, pengeluaran, outlet, dan laba tidak lagi tersebar di tempat berbeda.",
    items: ["Laporan laba", "Multi-outlet", "Role & akses"],
    preview: <OwnerFeaturePreview />,
  },
] as const;

export function Features() {
  return (
    <ScrollReveal className="bg-paper py-[clamp(4.5rem,8vw,7rem)]" id="fitur">
      <Container>
        <div className="mb-12 max-w-[42rem] lg:mb-16">
          <h2 className="text-balance font-display text-[clamp(2.65rem,5vw,4.5rem)] font-bold leading-[0.97] tracking-[-0.07em] text-green-950">Yang dikerjakan Rakku di belakang layar.</h2>
          <p className="mt-5 max-w-[34rem] text-[0.95rem] leading-[1.7] text-muted">Tiga bagian penting yang tetap terhubung ketika kedai mulai ramai.</p>
        </div>

        <Stagger className="grid border-t border-green-950/15 lg:grid-cols-[1.08fr_0.96fr_0.96fr]">
          {features.map((feature, index) => {
            return (
              <StaggerItem key={feature.number} className={`border-b border-green-950/15 py-8 sm:px-8 lg:border-b-0 lg:border-r lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0 ${index > 0 ? "lg:pl-8" : ""}`}>
                <article id={feature.label === "Kasir" ? "kasir" : feature.label === "Resep" ? "resep" : "laba"} className="flex h-full flex-col">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[0.65rem] font-semibold text-green-700">{feature.number}</span>
                    <span className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-green-700">{feature.label}</span>
                  </div>
                  <h3 className="mt-5 max-w-[16rem] font-display text-[clamp(1.55rem,2.4vw,2rem)] font-bold leading-[1.04] tracking-[-0.05em] text-green-950">{feature.title}</h3>
                  <div className="mt-7">{feature.preview}</div>
                  <p className="mt-5 max-w-[19rem] text-sm leading-[1.62] text-muted">{feature.description}</p>
                  <ul className="mt-5 flex flex-wrap gap-x-3 gap-y-2 font-mono text-[0.58rem] text-green-800/75">
                    {feature.items.map((item) => <li key={item} className="border-b border-green-800/20 pb-1">{item}</li>)}
                  </ul>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Container>
    </ScrollReveal>
  );
}
