import { CashierStepIcon, OutletStepIcon, ProductStepIcon, ReportStepIcon } from "./icons";
import { Stagger, StaggerItem } from "./motion";
import { Container, SectionKicker } from "./primitives";
import { ScrollReveal } from "./scroll-reveal";

const steps = [
  {
    number: "01",
    title: "Buat outlet",
    description: "Daftar sebagai Owner, buat company, lalu mulai dari outlet pertama Anda.",
    visual: <OutletStepIcon className="mb-5 h-14 w-14" />,
  },
  {
    number: "02",
    title: "Susun produk & resep",
    description: "Atur kategori, tier harga, modifier, bahan baku, dan resep produk.",
    visual: <ProductStepIcon className="mb-5 h-14 w-14" />,
  },
  {
    number: "03",
    title: "Kasir mulai berjualan",
    description: "Kasir login dengan alur cepat dan fokus menyelesaikan pesanan.",
    visual: <CashierStepIcon className="mb-5 h-14 w-14" />,
  },
  {
    number: "04",
    title: "Pantau yang penting",
    description: "Gunakan data penjualan, stok, HPP, dan pengeluaran untuk mengambil keputusan.",
    visual: <ReportStepIcon className="mb-5 h-14 w-14" />,
  },
];

export function Workflow() {
  return (
    <ScrollReveal className="bg-ivory py-[clamp(3.5rem,6vw,5.5rem)]" id="alur">
      <Container>
        <SectionKicker>03 / Alur kerja</SectionKicker>
        <div className="mb-8 flex flex-col gap-5 lg:mb-12 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <h2 className="font-display text-[clamp(2.45rem,4.5vw,4.05rem)] font-semibold leading-[1.02] text-green-950">
            Mulai sederhana.
            <br />
            <em className="not-italic text-green-700">Tumbuh dengan tenang.</em>
          </h2>
        </div>

        <Stagger className="grid border-t border-brand sm:grid-cols-2 lg:grid-cols-4 lg:border-t-0">
          {steps.map((step, index) => (
            <StaggerItem key={step.number} className={`min-h-[17.5rem] border-b border-brand py-6 lg:border-b-0 lg:border-r lg:px-6 lg:py-6 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0 ${index % 2 === 1 ? "sm:pl-5" : "sm:pr-5"}`}>
              <div id={index === 0 ? "cara-kerja" : undefined}>
                <span className="mb-5 block font-mono text-[0.65rem] text-coral">{step.number}</span>
                {step.visual}
                <h3 className="mb-2 font-display text-[1.45rem] font-semibold leading-[1.1] text-green-950">{step.title}</h3>
                <p className="m-0 max-w-[13.75rem] text-[0.8125rem] leading-[1.55] text-muted">{step.description}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </ScrollReveal>
  );
}
