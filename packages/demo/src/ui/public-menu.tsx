"use client";

import { Badge } from "@rakku/ui";
import type { PublicMenu } from "@rakku/shared-types";

const money = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

/** Only a sanitized menu prop crosses this public client boundary. No fixture or engine import. */
export function PublicMenuView({ menu }: { menu: PublicMenu }) {
  return <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
    <header>
      <Badge variant="info">Menu Demo · view-only</Badge>
      <h1 className="mt-3 text-3xl font-bold">{menu.outletName}</h1>
      <p className="mt-2 text-sm text-gray-500">Menu cafe fiktif. Halaman ini tidak menerima pesanan atau pembayaran.</p>
    </header>
    {menu.categories.map(category => <section key={category.id}>
      <h2 className="mb-4 text-xl font-bold">{category.name}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {category.products.map(product => <article key={product.id} className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-4">
          {product.image_url && <img src={product.image_url} alt="" width={80} height={80} className="h-20 w-20 rounded-xl object-cover" />}
          <div>
            <h3 className="font-semibold">{product.name}</h3>
            <p className="my-1 text-sm text-gray-500">{product.description}</p>
            <p className="font-bold text-green-800">{money(product.price)}</p>
          </div>
        </article>)}
      </div>
    </section>)}
  </div>;
}
