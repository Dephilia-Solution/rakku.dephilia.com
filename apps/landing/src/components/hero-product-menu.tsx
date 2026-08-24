"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import { SearchIcon } from "./icons";

type ProductCategory = "Semua" | "Coffee" | "Pastry" | "Non-coffee";

type HeroProduct = {
  id: string;
  image: string;
  category: Exclude<ProductCategory, "Semua">;
  name: string;
  price: string;
};

const products: HeroProduct[] = [
  { id: "kopi-susu-gula-aren", image: "/images/kopsuaren.webp", category: "Coffee", name: "Kopi Susu Gula Aren", price: "Rp 24.000" },
  { id: "cafe-latte", image: "/images/caffelatte.webp", category: "Coffee", name: "Cafe Latte", price: "Rp 22.000" },
  { id: "espresso", image: "/images/espresso.webp", category: "Coffee", name: "Espresso", price: "Rp 16.000" },
  { id: "butter-croissant", image: "/images/croissant.webp", category: "Pastry", name: "Butter Croissant", price: "Rp 18.000" },
  { id: "matcha-latte", image: "/images/matchalatte.webp", category: "Non-coffee", name: "Matcha Latte", price: "Rp 25.000" },
  { id: "banana-bread", image: "/images/bananabread.webp", category: "Pastry", name: "Banana Bread", price: "Rp 19.000" },
  { id: "lemon-tea", image: "/images/lemontea.webp", category: "Non-coffee", name: "Lemon Tea", price: "Rp 15.000" },
  { id: "chocolate-cookie", image: "/images/chococookie.webp", category: "Pastry", name: "Chocolate Cookie", price: "Rp 12.000" },
];

const previewProducts = products.slice(0, 4);

const categoryStyles: Record<HeroProduct["category"], string> = {
  Coffee: "bg-amber-100 text-amber-800",
  Pastry: "bg-orange-100 text-orange-800",
  "Non-coffee": "bg-green-100 text-green-800",
};

export function HeroProductMenu() {
  const [frameIndex, setFrameIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const selectedProduct = previewProducts[frameIndex] ?? previewProducts[0];

  useEffect(() => {
    if (reduceMotion !== false || previewProducts.length < 2) return;

    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % previewProducts.length);
    }, 2800);

    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  return (
    <figure
      role="img"
      aria-label="Preview tampilan POS Rakku"
      className="hero-pos-preview overflow-hidden rounded-[0.75rem] border border-neutral-200 bg-neutral-50 shadow-preview"
    >
      <div
        aria-hidden="true"
        className="flex aspect-[1.18] min-w-0 flex-col overflow-hidden sm:aspect-[1.45] lg:aspect-[1.6]"
      >
        <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-3 text-[0.55rem] text-neutral-500 sm:h-10 sm:px-4 sm:text-[0.62rem]">
          <span className="font-display font-semibold text-neutral-900">Kasir</span>
          <span className="truncate">Outlet Kemang</span>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="hidden w-10 shrink-0 flex-col items-center gap-2 border-r border-neutral-200 bg-white p-1.5 lg:flex">
            <Image src="/images/rakku_logo.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg object-cover" />
            <span className="mt-2 h-7 w-7 rounded-xl bg-primary" />
            <span className="h-7 w-7 rounded-xl bg-neutral-100" />
            <span className="h-7 w-7 rounded-xl bg-neutral-100" />
            <span className="h-7 w-7 rounded-xl bg-neutral-100" />
          </div>

          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_8.75rem] sm:grid-cols-[minmax(0,1fr)_11.5rem] lg:grid-cols-[minmax(0,1fr)_14rem]">
            <div className="min-h-0 min-w-0 overflow-hidden bg-neutral-50 p-2.5 sm:p-3.5">
              <div className="flex min-h-8 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 text-[0.55rem] text-neutral-400 sm:min-h-9 sm:px-3 sm:text-[0.62rem]">
                <SearchIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400 sm:h-4 sm:w-4" />
                <span className="truncate">Cari produk...</span>
                <span className="ml-auto hidden rounded-md bg-neutral-100 px-1.5 py-1 font-mono text-[0.48rem] text-neutral-400 sm:inline-flex">K</span>
              </div>

              <div className="mt-2 flex gap-1 overflow-hidden whitespace-nowrap text-[0.5rem] font-medium sm:mt-3 sm:text-[0.58rem]">
                <span className="shrink-0 rounded-full bg-forest px-2.5 py-1.5 text-white sm:px-3">All Items</span>
                <span className="shrink-0 rounded-full px-2.5 py-1.5 text-neutral-600 sm:px-3">Coffee</span>
                <span className="shrink-0 rounded-full px-2.5 py-1.5 text-neutral-600 sm:px-3">Pastry</span>
                <span className="shrink-0 rounded-full px-2.5 py-1.5 text-neutral-600 sm:px-3">Non-Coffee</span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:mt-3 sm:gap-2 lg:grid-cols-4">
                {previewProducts.map((product) => {
                  const isSelected = product.id === selectedProduct.id;

                  return (
                    <div
                      key={product.id}
                      className={`min-w-0 overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 ring-inset transition-[box-shadow,ring-color] duration-300 ${
                        isSelected ? "ring-2 ring-primary-500" : "ring-neutral-200"
                      }`}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                        <Image
                          src={product.image}
                          alt=""
                          fill
                          priority={product.id === previewProducts[0].id}
                          sizes="(max-width: 640px) 25vw, (max-width: 1024px) 18vw, 170px"
                          className="object-cover"
                        />
                        <span className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[0.42rem] font-medium sm:text-[0.48rem] ${categoryStyles[product.category]}`}>
                          {product.category === "Non-coffee" ? "Non-Coffee" : product.category}
                        </span>
                      </div>
                      <div className="p-1.5 sm:p-2">
                        <p className="min-h-[0.8rem] truncate text-[0.52rem] font-semibold leading-tight text-neutral-900 sm:text-[0.62rem]">{product.name}</p>
                        <p className="mt-1 truncate font-mono text-[0.48rem] font-semibold text-forest sm:text-[0.56rem]">{product.price}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-neutral-200 bg-white p-2.5 text-neutral-900 sm:p-3" aria-label="Preview order sidebar">
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-neutral-200 pb-2">
              <div className="min-w-0">
                <h2 className="truncate text-[0.68rem] font-semibold sm:text-[0.78rem]">Current Order</h2>
                <span className="mt-0.5 block text-[0.48rem] text-neutral-400 sm:text-[0.55rem]">1 item</span>
              </div>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-forest/40 text-[0.5rem] font-semibold text-forest">1</span>
            </div>

            <div className="shrink-0 border-b border-neutral-200 py-2">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-1.5 sm:px-2.5">
                <span className="block truncate text-[0.43rem] text-neutral-400 sm:text-[0.5rem]">Nama Customer</span>
                <span className="mt-0.5 block truncate text-[0.55rem] font-medium text-neutral-700 sm:text-[0.62rem]">Walk-in</span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden py-2">
              <span className="mb-1.5 block truncate text-[0.46rem] font-semibold uppercase tracking-[0.08em] text-neutral-400 sm:text-[0.52rem]">{selectedProduct.category}</span>
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    key={selectedProduct.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="min-h-[3.7rem] border-b border-neutral-200 px-2 py-2 sm:min-h-[4.3rem] sm:px-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-[0.55rem] font-semibold text-neutral-900 sm:text-[0.64rem]">{selectedProduct.name}</span>
                      <span className="shrink-0 font-mono text-[0.5rem] font-semibold text-forest sm:text-[0.56rem]">{selectedProduct.price}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-[0.48rem] text-neutral-500 sm:text-[0.54rem]">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-neutral-100 text-neutral-500">-</span>
                      <span className="grid h-5 min-w-5 place-items-center rounded-lg font-semibold text-neutral-900">1</span>
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-neutral-100 text-neutral-500">+</span>
                      <span className="ml-1 truncate">Regular</span>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="space-y-1 px-2 py-2 font-mono text-[0.48rem] text-neutral-600 sm:px-2.5 sm:text-[0.54rem]">
                  <div className="flex justify-between gap-2"><span>Subtotal</span><span className="shrink-0">{selectedProduct.price}</span></div>
                  <div className="flex justify-between gap-2 border-t border-neutral-200 pt-1.5 text-[0.58rem] font-bold text-neutral-900 sm:text-[0.64rem]"><span>Total</span><span className="shrink-0">{selectedProduct.price}</span></div>
                </div>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-1 border-t border-neutral-200 pt-2 text-center text-[0.44rem] font-semibold sm:text-[0.5rem]">
              <span className="rounded-xl bg-neutral-100 px-1.5 py-2 text-neutral-700">Bayar Nanti</span>
              <span className="rounded-xl bg-forest px-1.5 py-2 text-white">Payment</span>
            </div>
            </aside>
          </div>
        </div>
      </div>
    </figure>
  );
}
