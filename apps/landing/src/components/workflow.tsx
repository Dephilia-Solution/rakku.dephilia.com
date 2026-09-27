import { Container } from "./primitives";
import { ScrollReveal } from "./scroll-reveal";

const steps = [
  ["01", "Buat outlet", "Daftar sebagai Owner, buat company, lalu mulai dari outlet pertama."],
  ["02", "Susun produk", "Atur kategori, harga, modifier, bahan baku, dan resep."],
  ["03", "Kasir mulai berjualan", "Tim masuk ke POS dan menyelesaikan pesanan dengan alur singkat."],
  ["04", "Pantau yang penting", "Gunakan penjualan, stok, HPP, dan pengeluaran untuk mengambil keputusan."],
] as const;

export function Workflow() {
  return (
    <ScrollReveal className="bg-paper-deep py-[clamp(4.5rem,8vw,7rem)]" id="alur">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-[clamp(4rem,10vw,9rem)]">
          <div>
            <h2 className="max-w-[10ch] text-balance font-display text-[clamp(2.65rem,5vw,4.5rem)] font-bold leading-[0.97] tracking-[-0.07em] text-green-950">Dari setup sampai laporan.</h2>
            <p className="mt-5 max-w-[21rem] text-[0.95rem] leading-[1.7] text-muted">Mulai dari satu outlet. Bangun alur yang tetap terbaca ketika bisnis bertambah.</p>
          </div>

          <ol className="grid border-t border-green-950/15 sm:grid-cols-2 lg:grid-cols-4 lg:border-t-0">
            {steps.map(([number, title, description]) => (
              <li key={number} className="border-b border-green-950/15 py-6 sm:px-6 sm:first:pl-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:border-r lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-green-700/35 font-mono text-[0.6rem] font-semibold text-green-700">{number}</span>
                  <span className="h-px flex-1 bg-green-950/10 lg:hidden" />
                </div>
                <h3 className="mt-6 max-w-[11rem] font-display text-[1.3rem] font-bold leading-[1.1] tracking-[-0.04em] text-green-950">{title}</h3>
                <p className="mt-3 max-w-[14rem] text-sm leading-[1.6] text-muted">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </ScrollReveal>
  );
}
