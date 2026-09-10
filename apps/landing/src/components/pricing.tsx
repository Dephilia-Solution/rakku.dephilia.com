"use client";

import { useState } from "react";

import { CheckIcon } from "./icons";
import { ButtonLink } from "./motion";
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
    tagline: "Untuk kedai yang baru mulai",
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
    tagline: "Untuk cafe yang sedang berkembang",
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
    cta: "Coba Pro 14 hari",
    highlighted: true,
  },
  {
    slug: "business",
    name: "Business",
    tagline: "Untuk bisnis multi-cabang",
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
      "Audit log tenant",
      "Prioritas support",
    ],
    cta: "Mulai Business",
  },
];

function formatRupiah(value: number): string {
  return `Rp${value.toLocaleString("id-ID")}`;
}

export function Pricing() {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <ScrollReveal className="bg-paper-deep py-[clamp(4.5rem,8vw,7rem)]" id="harga">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SectionKicker>Harga/Paket</SectionKicker>
            <h2 className="max-w-[16ch] text-balance font-display text-[clamp(2.65rem,5vw,4.5rem)] font-bold leading-[0.97] tracking-[-0.07em] text-green-950">
              Gratis untuk mulai, upgrade saat tumbuh.
            </h2>
            <p className="mt-6 max-w-[34rem] text-[0.95rem] leading-[1.7] text-muted">
              Fitur kasir inti selalu gratis. Batas paket naik mengikuti jumlah
              outlet, karyawan, dan transaksi — tanpa biaya tersembunyi.
            </p>
          </div>

          <div className="inline-flex w-fit rounded-full border border-green-950/15 bg-ivory p-1">
            {(
              [
                { value: "monthly", label: "Bulanan" },
                { value: "yearly", label: "Tahunan · hemat 2 bulan" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setCycle(option.value)}
                aria-pressed={cycle === option.value}
                className={`rounded-full px-4 py-2 text-[0.75rem] font-bold transition-colors duration-200 ${
                  cycle === option.value
                    ? "bg-green-950 text-ivory"
                    : "text-green-950/60 hover:text-green-950"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => {
            const price = cycle === "yearly" ? plan.yearly : plan.monthly;
            const highlighted = Boolean(plan.highlighted);

            return (
              <article
                key={plan.slug}
                className={`flex flex-col p-6 sm:p-7 ${
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
                      Populer
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
                  <span className="font-display text-[2.6rem] font-bold leading-none tracking-[-0.06em]">
                    {price === 0 ? "Gratis" : formatRupiah(price)}
                  </span>
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
                {cycle === "yearly" && plan.monthly > 0 ? (
                  <p
                    className={`mt-1 text-[0.75rem] ${
                      highlighted ? "text-lime" : "text-green-700"
                    }`}
                  >
                    setara {formatRupiah(Math.round(plan.yearly / 12))}/bulan
                  </p>
                ) : null}

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
            );
          })}
        </div>

        <p className="mt-8 text-center text-[0.8rem] text-muted">
          Pembayaran QRIS lewat dashboard Owner. Paket aktif otomatis setelah
          pembayaran berhasil — bisa berhenti kapan saja.
        </p>
      </Container>
    </ScrollReveal>
  );
}
