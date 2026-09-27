import { CashierFeaturePreview, OwnerFeaturePreview, RecipeFeaturePreview } from "./feature-previews";
import { Stagger, StaggerItem } from "./motion";
import { Container } from "./primitives";
import { ScrollReveal } from "./scroll-reveal";

const features = [
  {
    id: "kasir",
    label: "Kasir",
    title: "Kasir yang mengikuti ritme antrean.",
    description: "Produk, modifier, meja, pembayaran, dan invoice berada di satu alur yang singkat.",
    items: ["Dine in & take away", "QRIS & tunai", "Split bill"],
    preview: <CashierFeaturePreview />,
  },
  {
    id: "resep",
    label: "Resep",
    title: "Resep membuat stok lebih masuk akal.",
    description: "Hubungkan produk dengan bahan baku. Setiap order selesai meninggalkan catatan pemakaian.",
    items: ["Resep per produk", "Stock movement", "Peringatan stok"],
    preview: <RecipeFeaturePreview />,
  },
  {
    id: "laba",
    label: "Owner",
    title: "Owner melihat yang perlu diputuskan.",
    description: "Omzet, HPP, pengeluaran, outlet, dan laba tidak lagi tersebar di tempat berbeda.",
    items: ["Laporan laba", "Multi-outlet", "Role & akses"],
    preview: <OwnerFeaturePreview />,
  },
] as const;

type Feature = (typeof features)[number];

export function Features() {
  return (
    <ScrollReveal className="bg-paper py-[clamp(4.5rem,8vw,7rem)]" id="fitur">
      <Container>
        <div className="mb-12 max-w-[42rem] lg:mb-16">
          <h2 className="text-balance font-display text-[clamp(2.65rem,5vw,4.5rem)] font-bold leading-[0.97] tracking-[-0.07em] text-green-950">Yang dikerjakan Rakku di belakang layar.</h2>
          <p className="mt-5 max-w-[34rem] text-[0.95rem] leading-[1.7] text-muted">Tiga bagian penting yang tetap terhubung ketika kedai mulai ramai.</p>
        </div>

        <Stagger className="grid min-w-0 gap-px overflow-hidden rounded-2xl border border-green-950/15 bg-green-950/15 lg:grid-cols-3">
          {features.map((feature) => (
            <StaggerItem
              key={feature.id}
              className="min-w-0 border-b border-green-950/15 bg-ivory last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
            >
              <FeaturePanel feature={feature} />
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </ScrollReveal>
  );
}

function FeaturePanel({ feature }: { feature: Feature }) {
  return (
    <article id={feature.id} className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex border-l-2 border-green-700 pl-3 text-sm font-semibold text-green-800">{feature.label}</span>
        <span className="h-px flex-1 bg-green-950/10" aria-hidden="true" />
      </div>

      <h3 className="mt-5 max-w-[18rem] font-display text-[clamp(1.5rem,2.4vw,2rem)] font-bold leading-[1.02] tracking-[-0.055em] text-green-950">
        {feature.title}
      </h3>

      <div className="mt-6 min-w-0">{feature.preview}</div>

      <div className="mt-6">
        <p className="max-w-[22rem] text-sm leading-[1.62] text-muted">{feature.description}</p>
        <ul className="mt-5 flex flex-wrap gap-x-3 gap-y-2 text-xs font-medium text-green-800/75">
          {feature.items.map((item) => (
            <li key={item} className="border-b border-green-800/20 pb-1">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
