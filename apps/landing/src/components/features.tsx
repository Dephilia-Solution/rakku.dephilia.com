import type { PropsWithChildren } from "react";

import { KeyIcon, PackageIcon, QrCodeIcon, ReceiptIcon, StoreIcon, TrendingUpIcon } from "./icons";
import { Lift, Stagger, StaggerItem } from "./motion";
import { Container, SectionKicker } from "./primitives";
import { ScrollReveal } from "./scroll-reveal";

export function FeatureIcon({ className = "", children }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`mt-4 grid h-[3.75rem] w-[3.75rem] place-items-center rounded-[0.9rem] ${className}`} aria-hidden="true">
      {children}
    </div>
  );
}

export function FeatureCard({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <Lift className={`group flex h-full min-h-[20.5rem] flex-col items-start overflow-hidden rounded-lg border border-brand p-6 ${className}`}>{children}</Lift>;
}

const iconMotion = "transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105";

export function Features() {
  return (
    <ScrollReveal className="bg-paper-deep py-[clamp(3.5rem,6vw,5.5rem)]" id="fitur">
      <Container>
        <Stagger className="mb-10 flex flex-col gap-6 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
          <StaggerItem>
            <div>
              <SectionKicker>02 / Yang Anda dapatkan</SectionKicker>
              <h2 className="font-display text-[clamp(2.45rem,4.5vw,4.05rem)] font-semibold leading-[1.02] text-green-950">
                Kerja harian lebih ringan.
                <br />
                <em className="not-italic text-green-700">Keputusan lebih tajam.</em>
              </h2>
            </div>
          </StaggerItem>
        </Stagger>

        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StaggerItem className="sm:col-span-2">
            <FeatureCard className="bg-green-950 text-ivory hover:shadow-xl">
              <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ivory/70">A / Kasir</div>
              <FeatureIcon className="bg-lime text-green-950">
                <ReceiptIcon className={`h-8 w-8 ${iconMotion}`} />
              </FeatureIcon>
              <h3 className="mt-5 max-w-[16.25rem] font-display text-[clamp(1.5rem,2.2vw,1.65rem)] font-semibold leading-[1.08] text-lime">Transaksi tanpa menghambat antrean.</h3>
              <p className="my-2 max-w-[18.5rem] text-[0.8125rem] leading-[1.58] text-ivory/65">Register yang cepat untuk produk, modifier, tier harga, meja, pembayaran, split bill, dan invoice.</p>
              <div className="mt-auto w-full border-t border-ivory/20 pt-3 font-mono text-[0.5rem] text-ivory/60">Dine in / Take away / QRIS / Tunai</div>
            </FeatureCard>
          </StaggerItem>

          <StaggerItem>
            <FeatureCard className="bg-lime text-green-950 hover:shadow-xl">
              <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-green-900/80">B / Inventory</div>
              <FeatureIcon className="bg-green-950 text-lime">
                <PackageIcon className={`h-8 w-8 ${iconMotion}`} />
              </FeatureIcon>
              <h3 className="mt-5 max-w-[16.25rem] font-display text-[clamp(1.5rem,2.2vw,1.65rem)] font-semibold leading-[1.08]">Bahan baku yang ikut bergerak.</h3>
              <p className="my-2 max-w-[18.5rem] text-[0.8125rem] leading-[1.58] text-green-900/75">Hubungkan produk ke resep. Setiap order selesai, stok berkurang dan jejaknya tersimpan.</p>
            </FeatureCard>
          </StaggerItem>

          <StaggerItem>
            <FeatureCard className="bg-ivory/50 hover:shadow-xl">
              <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">C / Owner</div>
              <FeatureIcon className="bg-green-300 text-green-950">
                <TrendingUpIcon className={`h-8 w-8 ${iconMotion}`} />
              </FeatureIcon>
              <h3 className="mt-5 max-w-[16.25rem] font-display text-[clamp(1.5rem,2.2vw,1.65rem)] font-semibold leading-[1.08] text-green-950">Laba, bukan sekadar omzet.</h3>
              <p className="m-0 max-w-[18.5rem] text-[0.8125rem] leading-[1.58] text-muted">Lihat omzet, HPP, pengeluaran, laba kotor, dan laba bersih dalam satu laporan.</p>
            </FeatureCard>
          </StaggerItem>

          <StaggerItem className="sm:col-span-2">
            <FeatureCard className="bg-ivory/50 hover:shadow-xl">
              <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">D / Multi-outlet</div>
              <FeatureIcon className="bg-green-800 text-ivory">
                <StoreIcon className={`h-8 w-8 ${iconMotion}`} />
              </FeatureIcon>
              <h3 className="mt-5 max-w-[16.25rem] font-display text-[clamp(1.5rem,2.2vw,1.65rem)] font-semibold leading-[1.08] text-green-950">Satu pemilik. Banyak outlet. Tetap terarah.</h3>
              <p className="m-0 max-w-[18.5rem] text-[0.8125rem] leading-[1.58] text-muted">Kelola outlet, karyawan, produk, akses menu, dan laporan dalam konteks yang jelas per cabang.</p>
            </FeatureCard>
          </StaggerItem>

          <StaggerItem>
            <FeatureCard className="bg-green-950 text-ivory hover:shadow-xl">
              <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ivory/70">E / Akses</div>
              <FeatureIcon className="bg-lime text-green-950">
                <KeyIcon className={`h-8 w-8 ${iconMotion}`} />
              </FeatureIcon>
              <h3 className="mt-5 max-w-[16.25rem] font-display text-[clamp(1.5rem,2.2vw,1.65rem)] font-semibold leading-[1.08] text-lime">Setiap orang melihat yang perlu.</h3>
              <p className="m-0 max-w-[18.5rem] text-[0.8125rem] leading-[1.58] text-ivory/65">Role dan akses menu dinamis untuk menjaga operasional tetap aman dan tidak membingungkan.</p>
            </FeatureCard>
          </StaggerItem>

          <StaggerItem className="sm:col-span-2">
            <FeatureCard className="bg-coral text-ivory hover:shadow-xl">
              <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ivory/80">F / QR Menu</div>
              <FeatureIcon className="bg-ivory text-green-950">
                <QrCodeIcon className={`h-8 w-8 ${iconMotion}`} />
              </FeatureIcon>
              <h3 className="mt-5 max-w-[16.25rem] font-display text-[clamp(1.5rem,2.2vw,1.65rem)] font-semibold leading-[1.08]">Menu digital tanpa aplikasi.</h3>
              <p className="m-0 max-w-[18.5rem] text-[0.8125rem] leading-[1.58] text-ivory/80">Buat QR menu view-only untuk tiap outlet. Pelanggan cukup scan dan melihat katalog terbaru.</p>
            </FeatureCard>
          </StaggerItem>
        </Stagger>
      </Container>
    </ScrollReveal>
  );
}
