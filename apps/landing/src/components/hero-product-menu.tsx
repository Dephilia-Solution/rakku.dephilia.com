"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";

type ProductCategory = "All Items" | "Coffee" | "Pastry" | "Non-Coffee";

type HeroProduct = {
  id: string;
  image: string;
  alt: string;
  category: Exclude<ProductCategory, "All Items">;
  label: string;
  name: string;
  price: string;
  tone: string;
};

const categories: ProductCategory[] = ["All Items", "Coffee", "Pastry", "Non-Coffee"];

// Replace these image paths when the final product photography is ready.
const products: HeroProduct[] = [
  {
    id: "kopi-susu-gula-aren",
    image: "/images/kopsuaren.webp",
    alt: "Kopi Susu Gula Aren",
    category: "Coffee",
    label: "COFFEE",
    name: "Kopi Susu Gula Aren",
    price: "Rp 24.000",
    tone: "product-coffee",
  },
  {
    id: "cafe-latte",
    image: "/images/caffelatte.webp",
    alt: "Cafe Latte",
    category: "Coffee",
    label: "COFFEE",
    name: "Cafe Latte",
    price: "Rp 22.000",
    tone: "product-latte",
  },
  {
    id: "espresso",
    image: "/images/espresso.webp",
    alt: "Espresso",
    category: "Coffee",
    label: "COFFEE",
    name: "Espresso",
    price: "Rp 16.000",
    tone: "product-espresso",
  },
  {
    id: "matcha-latte",
    image: "/images/matchalatte.webp",
    alt: "Matcha Latte",
    category: "Non-Coffee",
    label: "NON-COFFEE",
    name: "Matcha Latte",
    price: "Rp 25.000",
    tone: "product-latte",
  },
  {
    id: "butter-croissant",
    image: "/images/croissant.webp",
    alt: "Butter Croissant",
    category: "Pastry",
    label: "PASTRY",
    name: "Butter Croissant",
    price: "Rp 18.000",
    tone: "product-pastry",
  },
  {
    id: "banana-bread",
    image: "/images/bananabread.webp",
    alt: "Banana Bread",
    category: "Pastry",
    label: "PASTRY",
    name: "Banana Bread",
    price: "Rp 19.000",
    tone: "product-pastry",
  },
  {
    id: "lemon-tea",
    image: "/images/lemontea.webp",
    alt: "Lemon Tea",
    category: "Non-Coffee",
    label: "NON-COFFEE",
    name: "Lemon Tea",
    price: "Rp 15.000",
    tone: "product-espresso",
  },
  {
    id: "chocolate-cookie",
    image: "/images/chococookie.webp",
    alt: "Chocolate Cookie",
    category: "Pastry",
    label: "PASTRY",
    name: "Chocolate Cookie",
    price: "Rp 12.000",
    tone: "product-pastry",
  },
];

const productSpring = { type: "spring", stiffness: 420, damping: 30, mass: 0.45 } as const;

export function HeroProductMenu() {
  const [category, setCategory] = useState<ProductCategory>("All Items");
  const [selectedProduct, setSelectedProduct] = useState(products[0].id);
  const productsScrollerRef = useRef<HTMLDivElement>(null);

  const visibleProducts = category === "All Items" ? products : products.filter((product) => product.category === category);

  function selectCategory(nextCategory: ProductCategory) {
    setCategory(nextCategory);
    setSelectedProduct((current) => {
      const nextProducts = nextCategory === "All Items" ? products : products.filter((product) => product.category === nextCategory);
      return nextProducts.some((product) => product.id === current) ? current : nextProducts[0].id;
    });
    productsScrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <div className="pos-menu-heading mt-2">
        <strong>Produk</strong>
        
      </div>
      <div className="pos-categories" role="tablist" aria-label="Kategori produk">
        {categories.map((item) => {
          const isActive = category === item;

          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="hero-product-list"
              className={isActive ? "active" : ""}
              onClick={() => selectCategory(item)}
            >
              {item}
              {isActive ? <motion.span layoutId="hero-category-indicator" className="pos-category-indicator" /> : null}
            </button>
          );
        })}
      </div>
      <div ref={productsScrollerRef} id="hero-product-list" className="pos-products-scroll" role="tabpanel" tabIndex={0} aria-label={`Produk kategori ${category}`}>
        <div className="pos-products">
          <AnimatePresence initial mode="popLayout">
            {visibleProducts.map((product, index) => {
              const isSelected = selectedProduct === product.id;

              return (
                <motion.button
                  key={product.id}
                  type="button"
                  className={`pos-product-card ${isSelected ? "is-selected" : ""}`}
                  aria-pressed={isSelected}
                  aria-label={`Pilih ${product.name}`}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ ...productSpring, delay: index * 0.035 }}
                  onClick={() => setSelectedProduct(product.id)}
                >
                  <div className={`pos-product-image ${product.tone}`}>
                    <Image src={product.image} alt={product.alt} fill sizes="(max-width: 767px) 35vw, 115px" />
                  </div>
                  <span className="pos-category">{product.label}</span>
                  <strong>{product.name}</strong>
                  <b>{product.price}</b>
                  {isSelected ? <span className="pos-product-selected" aria-hidden="true">✓</span> : null}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
