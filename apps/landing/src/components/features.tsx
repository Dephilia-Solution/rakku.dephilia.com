import { CashierFeaturePreview, OwnerFeaturePreview, RecipeFeaturePreview } from "./feature-previews";
import { Stagger, StaggerItem } from "./motion";
import { Container } from "./primitives";
import { ScrollReveal } from "./scroll-reveal";

const features = [
  {
    id: "kasir",
    label: "Kasir",
    title: "Pilih. Sesuaikan. Selesai.",
    description: "Pilih menu, tambahkan add-on, tentukan harga sesuai jenis layanan, lalu bayar. Pesanan dan pembayaran tersusun dalam satu alur.",
    items: ["Add-on & tier harga", "Tunai & QRIS", "Draft & split bill"],
    preview: <CashierFeaturePreview />,
  },
  {
    id: "resep",
    label: "Resep",
    title: "Atur sampai ke resep.",
    description: "Simpan bahan dan takaran per porsi untuk setiap menu. Begitu transaksi selesai, pemakaian bahan otomatis tercatat sesuai resep produk.",
    items: ["Resep per menu", "Pemakaian bahan", "Peringatan stok"],
    preview: <RecipeFeaturePreview />,
  },
  {
    id: "laba",
    label: "Owner",
    title: "Semua angka, sekali buka.",
    description: "Buka dashboard untuk membaca omzet, menu favorit restomu, dan bahan yang perlu perhatian. Laporan HPP dan laba rugi tersedia mulai paket Pro.",
    items: ["Tren penjualan", "Menu terlaris", "HPP & laba (Pro)"],
    preview: <OwnerFeaturePreview />,
  },
] as const;

type Feature = (typeof features)[number];

export function Features() {
  return (
    <ScrollReveal className="bg-paper py-[clamp(4.5rem,8vw,7rem)]" id="fitur" reveal="heading">
      <Container>
        <div data-reveal-heading className="mb-12 max-w-[42rem] lg:mb-16">
          <h2 className="text-balance font-display text-[clamp(2.65rem,5vw,4.5rem)] font-bold leading-[0.97] tracking-[-0.07em] text-green-950">Kasir, resep, dan laporan. Nyambung.</h2>
          <p className="mt-5 max-w-[34rem] text-[0.95rem] leading-[1.7] text-muted">Dari memilih menu sampai membaca penjualan, tiap bagian memakai data yang saling terhubung.</p>
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
    <article id={feature.id} className="landing-feature flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex border-l-2 border-green-700 pl-3 text-sm font-semibold text-green-800">{feature.label}</span>
        <span className="h-px flex-1 bg-green-950/10" aria-hidden="true" />
      </div>

      <h3 className="mt-5 max-w-[18rem] font-display text-[clamp(1.5rem,2.4vw,2rem)] font-bold leading-[1.02] tracking-[-0.055em] text-green-950">
        {feature.title}
      </h3>

      <div className="landing-feature-preview mt-6 min-w-0">{feature.preview}</div>

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
