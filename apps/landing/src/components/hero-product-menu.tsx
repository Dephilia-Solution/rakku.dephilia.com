"use client";

import Image from "next/image";
import { useState, type KeyboardEvent } from "react";

import { CheckIcon, SearchIcon } from "./icons";

type ProductCategory = "Semua" | "Coffee" | "Pastry" | "Non-coffee";

type HeroProduct = {
  id: string;
  image: string;
  alt: string;
  category: Exclude<ProductCategory, "Semua">;
  name: string;
  price: string;
};

const categories: ProductCategory[] = ["Semua", "Coffee", "Pastry", "Non-coffee"];

const products: HeroProduct[] = [
  { id: "kopi-susu-gula-aren", image: "/images/kopsuaren.webp", alt: "Kopi susu gula aren", category: "Coffee", name: "Kopi Susu Gula Aren", price: "Rp 24.000" },
  { id: "cafe-latte", image: "/images/caffelatte.webp", alt: "Cafe latte", category: "Coffee", name: "Cafe Latte", price: "Rp 22.000" },
  { id: "espresso", image: "/images/espresso.webp", alt: "Espresso", category: "Coffee", name: "Espresso", price: "Rp 16.000" },
  { id: "matcha-latte", image: "/images/matchalatte.webp", alt: "Matcha latte", category: "Non-coffee", name: "Matcha Latte", price: "Rp 25.000" },
  { id: "butter-croissant", image: "/images/croissant.webp", alt: "Butter croissant", category: "Pastry", name: "Butter Croissant", price: "Rp 18.000" },
  { id: "banana-bread", image: "/images/bananabread.webp", alt: "Banana bread", category: "Pastry", name: "Banana Bread", price: "Rp 19.000" },
  { id: "lemon-tea", image: "/images/lemontea.webp", alt: "Lemon tea", category: "Non-coffee", name: "Lemon Tea", price: "Rp 15.000" },
  { id: "chocolate-cookie", image: "/images/chococookie.webp", alt: "Chocolate cookie", category: "Pastry", name: "Chocolate Cookie", price: "Rp 12.000" },
];

export function HeroProductMenu() {
  const [category, setCategory] = useState<ProductCategory>("Semua");
  const [selectedProductId, setSelectedProductId] = useState(products[0].id);

  const visibleProducts = category === "Semua" ? products : products.filter((product) => product.category === category);
  const displayedProducts = visibleProducts.slice(0, 6);
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];

  function selectCategory(nextCategory: ProductCategory) {
    setCategory(nextCategory);

    const nextProducts = nextCategory === "Semua" ? products : products.filter((product) => product.category === nextCategory);
    if (!nextProducts.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(nextProducts[0].id);
    }
  }

  function handleCategoryKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!direction) return;

    event.preventDefault();
    const nextIndex = (index + direction + categories.length) % categories.length;
    const nextCategory = categories[nextIndex];
    selectCategory(nextCategory);
    document.getElementById(`hero-category-${nextIndex}`)?.focus();
  }

  return (
    <div className="overflow-hidden rounded-[0.65rem] border border-green-950/15 bg-[#f7f9f4] shadow-preview">
      <div className="flex items-center gap-3 border-b border-green-950/10 bg-ivory px-4 py-3 sm:px-5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-green-700/35" />
          <span className="h-1.5 w-1.5 rounded-full bg-green-700/20" />
          <span className="h-1.5 w-1.5 rounded-full bg-green-700/20" />
        </div>
        <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-green-900/50">pos / register</span>
        <span className="ml-auto hidden font-mono text-[0.56rem] uppercase tracking-[0.12em] text-green-700 sm:block">RAKKU POS</span>
      </div>

      <div className="grid lg:grid-cols-[3.2rem_minmax(0,1fr)]">
        <aside className="hidden flex-col items-center gap-5 bg-green-950 px-2 py-4 lg:flex" aria-hidden="true">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-lime font-display text-base font-bold text-green-950">r</span>
          <span className="h-6 w-6 rounded-md border border-lime bg-lime/15" />
          <span className="h-6 w-6 rounded-md border border-ivory/30" />
          <span className="h-6 w-6 rounded-md border border-ivory/30" />
          <span className="h-6 w-6 rounded-md border border-ivory/30" />
          <span className="mt-auto font-mono text-[0.48rem] uppercase text-ivory/60">rk</span>
        </aside>

        <div className="min-w-0 bg-[#f7f9f4]">
          <div className="flex items-start justify-between gap-4 border-b border-green-950/10 px-4 py-4 sm:px-5">
            <div>
              <span className="block font-mono text-[0.56rem] uppercase tracking-[0.14em] text-green-900/50">Outlet aktif</span>
              <strong className="mt-1 block text-base font-bold tracking-[-0.035em] text-green-950 sm:text-lg">Kasir / Register</strong>
            </div>
            <span className="inline-flex items-center gap-2 font-mono text-[0.56rem] uppercase tracking-[0.1em] text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Outlet Kemang
            </span>
          </div>

          <div className="border-b border-green-950/10 px-4 py-3 sm:px-5">
            <div className="flex min-h-10 items-center gap-2 rounded-md border border-green-950/10 bg-ivory px-3 text-[0.68rem] text-green-900/45" role="search">
              <SearchIcon className="h-4 w-4 shrink-0 text-green-700/70" />
              <span>Cari produk...</span>
              <kbd className="ml-auto rounded border border-green-950/10 bg-[#f1f3ed] px-1.5 py-1 font-mono text-[0.52rem] text-green-900/45">K</kbd>
            </div>
          </div>

          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_15.5rem]">
            <div className="min-w-0">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <span className="block font-mono text-[0.56rem] uppercase tracking-[0.13em] text-green-700/70">Menu</span>
                  <h2 className="mt-1 text-lg font-bold tracking-[-0.04em] text-green-950">Pilih produk</h2>
                </div>
                <span className="font-mono text-[0.56rem] text-green-900/45">{displayedProducts.length} item</span>
              </div>

              <div className="mb-4 flex gap-1 overflow-x-auto border-b border-green-950/10" role="tablist" aria-label="Kategori produk">
                {categories.map((item, index) => {
                  const isActive = category === item;

                  return (
                    <button
                      key={item}
                      id={`hero-category-${index}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls="hero-product-list"
                      tabIndex={isActive ? 0 : -1}
                      className={`min-h-11 shrink-0 border-b-2 px-2 text-[0.68rem] font-semibold transition-colors active:scale-[0.98] ${
                        isActive ? "border-green-700 text-green-950" : "border-transparent text-green-900/45 hover:text-green-800"
                      }`}
                      onClick={() => selectCategory(item)}
                      onKeyDown={(event) => handleCategoryKeyDown(event, index)}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <div id="hero-product-list" role="tabpanel" aria-label={`Produk kategori ${category}`} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {displayedProducts.map((product) => {
                  const isSelected = selectedProductId === product.id;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`Pilih ${product.name}`}
                      className={`group relative min-w-0 rounded-md border bg-ivory p-2 text-left transition-[border-color,box-shadow,transform] active:scale-[0.98] ${
                        isSelected ? "border-green-700 shadow-sm" : "border-green-950/10 hover:-translate-y-0.5 hover:border-green-500/60"
                      }`}
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <div className="relative mb-2 aspect-[1.18] overflow-hidden rounded-[0.3rem] bg-[#e7efe0]">
                        <Image src={product.image} alt={product.alt} fill priority={product.id === products[0].id} sizes="(max-width: 640px) 42vw, (max-width: 1024px) 16vw, 130px" className="object-contain p-1 transition-transform duration-300 group-hover:scale-[1.03]" />
                      </div>
                      <span className="block truncate font-mono text-[0.52rem] uppercase tracking-[0.1em] text-green-900/45">{product.category}</span>
                      <strong className="mt-1 block min-h-[2.35rem] text-[0.7rem] font-semibold leading-[1.25] tracking-[-0.02em] text-green-950">{product.name}</strong>
                      <span className="mt-2 block font-mono text-[0.62rem] font-semibold text-green-700">{product.price}</span>
                      {isSelected ? (
                        <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-lime text-green-950">
                          <CheckIcon className="h-3 w-3" strokeWidth={2.4} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="flex min-h-[18rem] flex-col rounded-md bg-green-950 p-4 text-ivory" aria-label="Pesanan saat ini">
              <div className="flex items-start justify-between gap-3 border-b border-ivory/15 pb-3">
                <div>
                  <span className="block font-mono text-[0.54rem] uppercase tracking-[0.14em] text-ivory/55">Order berjalan</span>
                  <strong className="mt-1 block text-sm tracking-[-0.02em]">Pesanan baru</strong>
                </div>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-lime text-[0.62rem] font-bold text-green-950">1</span>
              </div>

              <div className="flex flex-1 items-start gap-3 border-b border-ivory/15 py-4">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-ivory/10">
                  <Image src={selectedProduct.image} alt="" fill sizes="48px" className="object-contain p-1" />
                </div>
                <div className="min-w-0">
                  <strong className="block text-[0.74rem] leading-[1.3] text-ivory">{selectedProduct.name}</strong>
                  <span className="mt-1 block text-[0.64rem] text-ivory/55">{selectedProduct.category} · 1x</span>
                  <span className="mt-2 block font-mono text-[0.64rem] text-lime">{selectedProduct.price}</span>
                </div>
              </div>

              <div className="space-y-2 py-4 font-mono text-[0.62rem]">
                <div className="flex justify-between gap-3 text-ivory/55"><span>Subtotal</span><span className="text-ivory">{selectedProduct.price}</span></div>
                <div className="flex justify-between gap-3 border-t border-ivory/15 pt-3 text-[0.72rem] font-semibold"><span>Total</span><span className="text-lime">{selectedProduct.price}</span></div>
              </div>

              <div className="rounded bg-lime px-3 py-2.5 text-center text-[0.64rem] font-bold text-green-950">Lanjut ke pembayaran</div>
              <p className="mt-3 text-[0.6rem] leading-[1.5] text-ivory/50">Setelah order selesai, resep dan stok ikut diperbarui.</p>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
