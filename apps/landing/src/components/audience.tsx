import type { ReactNode } from "react";

import { ArrowUpRightIcon } from "./icons";
import { Lift, Stagger, StaggerItem } from "./motion";
import { Container, SectionKicker } from "./primitives";
import { ScrollReveal } from "./scroll-reveal";

type AudienceCardProps = {
  label: string;
  title: ReactNode;
  description: string;
  items: string[];
  owner?: boolean;
};

export function Audience() {
  const ownerItems = ["Outlet & karyawan", "HPP & laba rugi", "QR menu per outlet"];
  const cashierItems = ["Register cepat", "Draft & split bill", "PWA untuk operasional"];

  return (
    <ScrollReveal className="bg-paper py-[clamp(3.5rem,6vw,5.5rem)]" id="untuk-siapa">
      <Container>
        <div className="mb-8 flex flex-col gap-6 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SectionKicker>05 / Dua layar, satu ritme</SectionKicker>
            <h2 className="font-display text-[clamp(2.45rem,4.5vw,4.05rem)] font-semibold leading-[1.02] text-green-950">
              Owner berpikir jauh.
              <br />
              <em className="not-italic text-green-700">Kasir bergerak cepat.</em>
            </h2>
          </div>
        </div>

        <Stagger className="grid gap-3 md:grid-cols-2">
          <StaggerItem>
            <AudienceCard
              label="Portal Owner"
              title={
                <>
                  Untuk keputusan
                  <br />
                  di balik layar.
                </>
              }
              description="Kelola outlet, tim, katalog, harga, resep, pengeluaran, dan laporan laba dari satu dashboard."
              items={ownerItems}
              owner
            />
          </StaggerItem>
          <StaggerItem>
            <AudienceCard
              label="POS Kasir"
              title={
                <>
                  Untuk transaksi
                  <br />
                  di garis depan.
                </>
              }
              description="Login 4 langkah, pilih produk, atur modifier, kelola meja, terima pembayaran, dan cetak invoice."
              items={cashierItems}
            />
          </StaggerItem>
        </Stagger>
      </Container>
    </ScrollReveal>
  );
}

export function AudienceCard({ label, title, description, items, owner = false }: AudienceCardProps) {
  return (
    <Lift className={`relative flex h-full min-h-[26rem] flex-col overflow-hidden rounded-lg p-6 pb-[9.5rem] ${owner ? "bg-green-950 text-ivory" : "bg-lime text-green-950"}`}>
      <div className="relative z-10 flex items-center justify-between">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em]">{label}</span>
        <ArrowUpRightIcon className="h-5 w-5" />
      </div>

      <h3 className="relative z-10 mt-12 font-display text-[clamp(2.2rem,4.3vw,2.7rem)] font-semibold leading-[0.98]">{title}</h3>
      <p className={`relative z-10 mt-3 max-w-[20rem] text-sm leading-[1.6] ${owner ? "text-ivory/65" : "text-green-950/70"}`}>{description}</p>

      <div className="relative z-10 mt-4 flex max-w-[20rem] flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className={`rounded border px-2 py-1.5 font-mono text-[0.5rem] ${owner ? "border-ivory/20 text-ivory/75" : "border-green-950/20 text-green-950/75"}`}>
            {item}
          </span>
        ))}
      </div>

      {owner ? (
        <div className="pointer-events-none absolute -bottom-6 right-[-2rem] h-32 w-[55%] max-w-[16rem] rotate-[-5deg] rounded-t-lg border-[7px] border-ivory/20 bg-[#f7f9f2] p-4" aria-hidden="true">
          <div className="h-2.5 w-3/5 rounded-sm bg-[#d2e6c7]" />
          <div className="my-2 h-2.5 w-2/5 rounded-sm bg-[#e8efe3]" />
          <div className="h-2.5 w-4/5 rounded-sm bg-[#edf3e9]" />
          <span className="absolute right-5 top-8 h-11 w-11 rounded-full border-[8px] border-[#b9d99a]" />
        </div>
      ) : (
        <div className="pointer-events-none absolute -bottom-6 right-[-2rem] h-32 w-[55%] max-w-[16rem] rotate-[5deg] rounded-t-lg border-[7px] border-green-950/15 bg-[#fff9e6] p-4" aria-hidden="true">
          <div className="grid grid-cols-2 gap-2">
            <i className="h-8 rounded bg-[#e9d69a]" />
            <i className="h-8 rounded bg-[#d5e5ae]" />
            <i className="h-8 rounded bg-[#e5c99e]" />
            <i className="h-8 rounded bg-[#cfe1a7]" />
          </div>
          <div className="absolute bottom-4 right-5 h-12 w-16 rounded border border-green-950/15 bg-ivory" />
        </div>
      )}
    </Lift>
  );
}
