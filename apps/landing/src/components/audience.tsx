import type { ReactNode } from "react";

import { ArrowRightIcon } from "./icons";
import { InteractiveRow, MotionLink } from "./motion";
import { Container } from "./primitives";
import { ownerUrl, posUrl } from "./site";
import { ScrollReveal } from "./scroll-reveal";

type AudienceCardProps = {
  label: string;
  title: ReactNode;
  description: string;
  items: string[];
  href: string;
  id?: string;
};

export function Audience() {
  return (
    <ScrollReveal className="bg-paper py-[clamp(4.5rem,8vw,7rem)]" id="untuk-siapa">
      <Container>
        <div className="mb-12 max-w-[38rem] lg:mb-16">
          <h2 className="text-balance font-display text-[clamp(2.65rem,5vw,4.5rem)] font-bold leading-[0.97] tracking-[-0.07em] text-green-950">Produk, bahan, meja, staf. Satu sistem.</h2>
          <p className="mt-5 max-w-[32rem] text-[0.95rem] leading-[1.7] text-muted">Owner menyiapkan menu dan memantau usaha. Kasir memakai pengaturan yang sama untuk melayani pesanan.</p>
        </div>

        <div className="border-t border-green-950/15">
          <AudienceCard
            id="outlet"
            label="Portal Owner"
            title={<>Atur usahamu.<br className="hidden sm:block" /> Baca hasilnya.</>}
            description="Kelola produk, bahan baku, meja, dan staf per outlet. Buka dashboard penjualan, lalu telusuri laporan yang kamu butuhkan."
            items={["Menu, resep & harga", "Outlet, meja & staf", "Dashboard & laporan"]}
            href={`${ownerUrl}/login`}
          />
          <AudienceCard
            label="POS Kasir"
            title={<>Layani pesanan.<br className="hidden sm:block" /> Selesaikan pembayaran.</>}
            description="Pilih menu, sesuaikan add-on dan harga layanan, kelola meja, lalu terima pembayaran. Resep tersimpan dipakai untuk mencatat pemakaian bahan."
            items={["Menu & add-on", "Tunai, kartu & QRIS", "Draft & split bill"]}
            href={`${posUrl}/login`}
          />
        </div>
      </Container>
    </ScrollReveal>
  );
}

export function AudienceCard({ id, label, title, description, items, href }: AudienceCardProps) {
  return (
    <article id={id} className="border-b border-green-950/15">
      <InteractiveRow className="group grid gap-6 py-8 transition-colors duration-200 hover:bg-paper-deep/35 md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,18rem)_auto] md:items-start md:gap-8 md:px-4 md:first:pl-0 md:last:pr-0">
        <span className="text-sm font-semibold text-green-700/70 transition-colors duration-200 group-hover:text-green-700">{label}</span>
        <h3 className="m-0 font-display text-[clamp(1.8rem,3.2vw,2.6rem)] font-bold leading-[0.98] tracking-[-0.06em] text-green-950 transition-transform duration-200 group-hover:translate-x-1">{title}</h3>
        <div>
          <p className="m-0 max-w-[22rem] text-sm leading-[1.62] text-muted">{description}</p>
          <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-2 font-mono text-[0.58rem] text-green-800/75">
            {items.map((item) => <li key={item} className="border-b border-green-800/20 pb-1">{item}</li>)}
          </ul>
        </div>
        <MotionLink href={href} className="landing-link-underline inline-flex min-h-12 items-center gap-2 self-start text-[0.78rem] font-bold text-green-800 hover:text-green-950">
          Buka {label === "Portal Owner" ? "portal" : "POS"} <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </MotionLink>
      </InteractiveRow>
    </article>
  );
}
