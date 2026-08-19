import { Stagger, StaggerItem } from "./motion";
import { Container, SectionKicker } from "./primitives";
import { ScrollReveal } from "./scroll-reveal";

const questions = [
  ["Apakah Rakku hanya untuk cafe?", "Rakku paling cocok untuk kedai kopi, cafe, dan bisnis F&B kecil yang memiliki produk, transaksi, bahan baku, dan satu atau beberapa outlet."],
  ["Apakah stok langsung berkurang saat transaksi?", "Ya. Setelah order berstatus selesai, stok bahan akan berkurang mengikuti resep produk dan tercatat di stock movement."],
  ["Apakah stok yang kurang akan memblokir transaksi?", "Tidak. Stok boleh minus agar operasional tidak berhenti. Rakku memberi peringatan supaya tim bisa melakukan pengecekan atau restock."],
  ["Apakah menu QR bisa menerima pesanan langsung?", "Belum. Menu QR pada fase ini bersifat view-only. Pelanggan dapat melihat katalog dan harga tanpa login atau memasang aplikasi."],
  ["Siapa yang bisa melihat laporan laba?", "Laporan HPP dan laba rugi ditujukan untuk Owner. Akses menu dapat diatur sesuai role perusahaan."],
] as const;

export function FAQ() {
  return (
    <ScrollReveal className="bg-paper-deep py-[clamp(3.5rem,6vw,5.5rem)]" id="faq">
      <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-[5.5rem]">
        <div>
          <SectionKicker>06 / Pertanyaan umum</SectionKicker>
          <h2 className="font-display text-[clamp(2.45rem,4.5vw,4.05rem)] font-semibold leading-[1.02] text-green-950">
            Yang perlu diketahui
            <br />
            <em className="not-italic text-green-700">sebelum mulai.</em>
          </h2>
          <p className="mt-5 max-w-[17.5rem] text-sm leading-[1.65] text-muted">Rakku dibuat untuk kedai dan cafe kecil yang ingin bekerja lebih teratur tanpa menambah kerumitan.</p>
        </div>

        <Stagger className="border-t border-brand">
          {questions.map(([question, answer], index) => (
            <StaggerItem key={question}>
              <details open={index === 0} className="group border-b border-brand">
                <summary className="flex min-h-[4rem] cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-[clamp(1.15rem,2vw,1.3rem)] tracking-[-0.025em] text-green-950 transition-colors duration-200 marker:hidden group-hover:text-green-700 [&::-webkit-details-marker]:hidden">
                  <span>{question}</span>
                  <span className="text-2xl font-normal text-coral transition-transform duration-200 group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="faq-answer mb-4 mr-8 max-w-[39.375rem] text-sm leading-[1.65] text-muted">{answer}</p>
              </details>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </ScrollReveal>
  );
}
