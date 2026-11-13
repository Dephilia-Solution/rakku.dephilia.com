"use client";

import { useState } from "react";
import { SignupPromotionNotice } from "@rakku/ui";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";

import { CheckIcon } from "./icons";
import { ButtonLink, Stagger, StaggerItem } from "./motion";
import { Container, SectionKicker } from "./primitives";
import { ownerUrl } from "./site";
import { ScrollReveal } from "./scroll-reveal";

type Cycle = "monthly" | "yearly";

interface PlanCard {
  slug: string;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  limits: string[];
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const plans: PlanCard[] = [
  {
    slug: "free",
    name: "Free",
    tagline: "Mulai berjualan dengan fitur kasir inti",
    monthly: 0,
    yearly: 0,
    limits: [
      "1 outlet",
      "2 karyawan",
      "30 produk",
      "10 bahan baku",
      "500 transaksi/bulan",
    ],
    features: [
      "Kasir, pesanan, draft & split bill",
      "Pajak, diskon & tier harga",
      "Resep + potong stok otomatis",
      "QR menu & manajemen meja",
    ],
    cta: "Mulai gratis",
  },
  {
    slug: "pro",
    name: "Pro",
    tagline: "Baca lebih dalam, kelola lebih leluasa",
    monthly: 99000,
    yearly: 990000,
    limits: [
      "3 outlet",
      "15 karyawan",
      "500 produk",
      "Bahan baku tanpa batas",
      "5.000 transaksi/bulan",
    ],
    features: [
      "Semua fitur Free",
      "Laporan laba rugi (HPP)",
      "Pembelian, opname & alert stok",
      "Role custom + laporan via email",
      "QR menu tanpa branding Rakku",
    ],
    cta: "Coba Rakku",
    highlighted: true,
  },
  {
    slug: "business",
    name: "Business",
    tagline: "Untuk tim dan usaha dengan banyak cabang",
    monthly: 249000,
    yearly: 2490000,
    limits: [
      "Outlet tanpa batas",
      "Karyawan tanpa batas",
      "Produk tanpa batas",
      "Transaksi tanpa batas",
    ],
    features: [
      "Semua fitur Pro",
      "Kuota untuk banyak cabang",
      "Prioritas support",
    ],
    cta: "Daftarkan usaha",
  },
];

function formatRupiah(value: number): string {
  return `Rp${value.toLocaleString("id-ID")}`;
}

export function Pricing() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [changedCycle, setChangedCycle] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <ScrollReveal className="bg-paper-deep py-[clamp(4.5rem,8vw,7rem)]" id="harga" reveal="heading">
      <Container>
        <div data-reveal-heading className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SectionKicker>Harga/Paket</SectionKicker>
            <h2 className="max-w-[16ch] text-balance font-display text-[clamp(2.65rem,5vw,4.5rem)] font-bold leading-[0.97] tracking-[-0.07em] text-green-950">
              Mulai gratis. Pilih ruang untuk berkembang.
            </h2>
            <p className="mt-6 max-w-[34rem] text-[0.95rem] leading-[1.7] text-muted">
              Pakai paket Free untuk mulai berjualan. Pilih Pro atau Business saat kamu membutuhkan fitur dan kuota tambahan untuk restomu.
            </p>
          </div>

          <LayoutGroup id="landing-pricing-cycle">
          <div role="group" aria-label="Periode langganan" className="inline-flex w-fit rounded-full border border-green-950/15 bg-ivory p-1">
            {(
              [
                { value: "monthly", label: "Bulanan" },
                { value: "yearly", label: "Tahunan · hemat 2 bulan" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => { setCycle(option.value); setChangedCycle(true); }}
                aria-pressed={cycle === option.value}
                className={`relative isolate min-h-11 rounded-full px-4 py-2 text-[0.75rem] font-bold transition-colors duration-200 ${
                  cycle === option.value
                    ? "text-ivory"
                    : "text-green-950/60 hover:text-green-950"
                }`}
              >
                {cycle === option.value && <motion.span data-cycle-indicator aria-hidden="true" layoutId={reduceMotion ? undefined : "selected-cycle"} className="absolute inset-0 -z-10 rounded-full bg-green-950" transition={{type: "spring", stiffness: 420, damping: 36}} />}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          </LayoutGroup>
        </div>

        <Stagger className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => {
            const price = cycle === "yearly" ? plan.yearly : plan.monthly;
            const highlighted = Boolean(plan.highlighted);

            return (
              <StaggerItem key={plan.slug} className="h-full min-w-0">
              <article data-plan={plan.slug}
                className={`landing-plan relative flex h-full flex-col p-6 sm:p-7 ${
                  highlighted
                    ? "bg-green-950 text-ivory shadow-[0_24px_60px_-30px_rgba(16,44,29,0.9)]"
                    : "border border-green-950/12 bg-ivory text-green-950"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-2xl font-bold tracking-[-0.05em]">
                    {plan.name}
                  </h3>
                  {highlighted ? (
                    <span className="rounded-full bg-lime px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-green-950">
                      Lebih leluasa
                    </span>
                  ) : null}
                </div>
                <p
                  className={`mt-2 text-[0.85rem] leading-[1.6] ${
                    highlighted ? "text-ivory/65" : "text-muted"
                  }`}
                >
                  {plan.tagline}
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <motion.span key={cycle} initial={changedCycle && reduceMotion === false ? {opacity: .65, y: 5} : false} animate={{opacity: 1, y: 0}} transition={{duration: reduceMotion ? 0 : .22, ease: [.16,1,.3,1]}} className="inline-block font-display text-[2.6rem] font-bold leading-none tracking-[-0.06em]">
                    {price === 0 ? "Gratis" : formatRupiah(price)}
                  </motion.span>
                  {price > 0 ? (
                    <span
                      className={`text-[0.8rem] ${
                        highlighted ? "text-ivory/60" : "text-muted"
                      }`}
                    >
                      /{cycle === "yearly" ? "tahun" : "bulan"}
                    </span>
                  ) : null}
                </div>
                <div className="min-h-5">
                {cycle === "yearly" && plan.monthly > 0 ? (
                  <p
                    className={`mt-1 text-[0.75rem] ${
                      highlighted ? "text-lime" : "text-green-700"
                    }`}
                  >
                    setara {formatRupiah(Math.round(plan.yearly / 12))}/bulan
                  </p>
                ) : null}
                </div>

                {plan.slug === "pro" && (
                  <SignupPromotionNotice
                    endpoint={`${ownerUrl.replace(/\/$/, "")}/api/public/signup-promotion`}
                    variant="plan"
                    planName={plan.name}
                    className="mt-5 border-t border-ivory/15 pt-5 text-ivory"
                  />
                )}

                <ul
                  className={`mt-6 space-y-2.5 border-t pt-6 text-[0.85rem] ${
                    highlighted
                      ? "border-ivory/15 text-ivory/85"
                      : "border-green-950/10 text-green-950/80"
                  }`}
                >
                  {plan.limits.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckIcon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          highlighted ? "text-lime" : "text-green-700"
                        }`}
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <ul
                  className={`mt-5 space-y-2.5 text-[0.85rem] ${
                    highlighted ? "text-ivory/75" : "text-muted"
                  }`}
                >
                  {plan.features.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span
                        className={`mt-[0.55rem] h-1 w-1 shrink-0 rounded-full ${
                          highlighted ? "bg-lime" : "bg-green-700"
                        }`}
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 pt-2">
                  <ButtonLink
                    href={`${ownerUrl}/register`}
                    className={`w-full justify-center min-h-[3rem] ${
                      highlighted
                        ? "bg-lime text-green-950 hover:bg-[#e0ee94]"
                        : "border border-green-950/20 text-green-950 hover:border-green-950/50"
                    }`}
                  >
                    {plan.cta}
                  </ButtonLink>
                </div>
              </article>
              </StaggerItem>
            );
          })}
        </Stagger>

        <p className="mt-8 text-center text-[0.8rem] text-muted">
          Pilih siklus bulanan atau tahunan, lalu bayar langganan lewat QRIS di dashboard Owner. Penawaran pengguna baru mengikuti campaign dan S&amp;K yang sedang aktif.
        </p>
      </Container>
    </ScrollReveal>
  );
}
