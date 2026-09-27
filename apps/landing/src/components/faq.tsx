"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { PlusIcon } from "./icons";
import { Container } from "./primitives";
import { ScrollReveal } from "./scroll-reveal";

const questions = [
  ["Apakah Rakku hanya untuk cafe?", "Rakku paling cocok untuk kedai kopi, cafe, dan bisnis F&B kecil yang memiliki produk, transaksi, bahan baku, dan satu atau beberapa outlet."],
  ["Apakah ada paket gratis?", "Ada. Paket Free berlaku selamanya untuk 1 outlet, 2 karyawan, 30 produk, dan 500 transaksi per bulan. Fitur kasir inti seperti register, pesanan, draft, split bill, resep, dan QR menu tetap bisa dipakai."],
  ["Bagaimana cara upgrade dan membayar?", "Upgrade dilakukan dari halaman Langganan di dashboard Owner. Pembayaran memakai QRIS, lalu paket aktif otomatis setelah pembayaran berhasil. Pendaftar baru juga mendapat trial Pro 14 hari."],
  ["Apa yang terjadi kalau kuota transaksi habis?", "Transaksi masih bisa berjalan selama masa tenggang (tambahan 10% atau 3 hari). Setelah itu transaksi baru diblokir sampai upgrade — data lama tetap bisa diakses."],
  ["Kalau turun paket, apakah data hilang?", "Tidak. Data tetap tersimpan; hanya pembuatan baru di atas limit yang diblokir dan fitur Pro terkunci sampai upgrade lagi."],
  ["Apakah stok langsung berkurang saat transaksi?", "Ya. Setelah order berstatus selesai, stok bahan berkurang mengikuti resep produk dan tercatat di stock movement."],
  ["Apakah stok yang kurang akan memblokir transaksi?", "Tidak. Stok boleh minus agar operasional tidak berhenti. Rakku memberi peringatan supaya tim bisa melakukan pengecekan atau restock."],
  ["Apakah menu QR bisa menerima pesanan langsung?", "Belum. Menu QR pada fase ini bersifat view-only. Pelanggan dapat melihat katalog dan harga tanpa login atau memasang aplikasi."],
  ["Siapa yang bisa melihat laporan laba?", "Laporan HPP dan laba rugi ditujukan untuk Owner. Akses menu dapat diatur sesuai role perusahaan."],
] as const;

export function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  return (
    <ScrollReveal className="bg-paper-deep py-[clamp(4.5rem,8vw,7rem)]" id="faq">
      <Container className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-[clamp(4rem,9vw,8rem)]">
        <div>
          <h2 className="max-w-[10ch] text-balance font-display text-[clamp(2.65rem,5vw,4.5rem)] font-bold leading-[0.97] tracking-[-0.07em] text-green-950">Yang perlu diketahui sebelum mulai.</h2>
          <p className="mt-6 max-w-[22rem] text-[0.95rem] leading-[1.7] text-muted">Jawaban singkat untuk alur kerja Rakku saat ini.</p>
        </div>

        <div className="border-t border-green-950/15">
          {questions.map(([question, answer], index) => (
            <div key={question} className="border-b border-green-950/15">
              <motion.button
                type="button"
                id={`faq-question-${index}`}
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
                className="group flex min-h-16 w-full items-center justify-between gap-6 py-4 text-left font-display text-[clamp(1.1rem,2vw,1.35rem)] font-bold leading-[1.15] tracking-[-0.04em] text-green-950 transition-colors hover:text-green-700"
                onClick={() => setOpenIndex((current) => (current === index ? -1 : index))}
                whileHover={reduceMotion ? undefined : { y: -1 }}
                whileTap={reduceMotion ? undefined : { y: 1, scale: 0.995 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                <span>{question}</span>
                <motion.span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-green-800/20 text-green-700"
                  animate={{ rotate: reduceMotion ? 0 : openIndex === index ? 45 : 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  aria-hidden="true"
                >
                  <PlusIcon className="h-4 w-4" />
                </motion.span>
              </motion.button>
              <AnimatePresence initial={false}>
                {openIndex === index ? (
                  <motion.div
                    id={`faq-answer-${index}`}
                    key={`faq-answer-${index}`}
                    role="region"
                    aria-labelledby={`faq-question-${index}`}
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="mb-5 max-w-[39rem] pr-10 text-sm leading-[1.65] text-muted">{answer}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </Container>
    </ScrollReveal>
  );
}
