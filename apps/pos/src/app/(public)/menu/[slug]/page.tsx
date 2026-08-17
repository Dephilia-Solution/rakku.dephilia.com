import { notFound } from "next/navigation";
import Image from "next/image";
import { getPublicMenuBySlug } from "@/lib/supabase/queries.server";
import { formatCurrency } from "@/lib/dummy-data";
import { ImageIcon, UtensilsCrossed } from "lucide-react";

export const metadata = {
  title: "Menu",
  description: "Menu digital Rakku",
};

export default async function PublicMenuPage({
  params,
}: {
  params: { slug: string };
}) {
  const menu = await getPublicMenuBySlug(params.slug);

  if (!menu) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-forest text-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <UtensilsCrossed size={20} />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">
              {menu.outletName}
            </h1>
            <p className="text-xs text-white/70">Scan &amp; order — menu digital</p>
          </div>
        </div>
      </header>

      {/* Kategori */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {menu.categories.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            <p className="font-semibold text-neutral-500">Menu belum tersedia</p>
            <p className="text-sm mt-1">Silakan cek kembali nanti.</p>
          </div>
        ) : (
          menu.categories.map((category) => (
            <section key={category.id} className="mb-8">
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-3 border-b border-neutral-200 pb-2">
                {category.name}
              </h2>
              <div className="space-y-3">
                {category.products.length === 0 ? (
                  <p className="text-sm text-neutral-400">
                    Belum ada produk di kategori ini.
                  </p>
                ) : (
                  category.products.map((product) => (
                    <div
                      key={product.id}
                      className="flex gap-3 bg-white rounded-xl p-3 shadow-sm"
                    >
                      <div className="w-16 h-16 rounded-lg bg-neutral-100 relative overflow-hidden flex-shrink-0">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={20} className="text-neutral-300" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-neutral-900">
                          {product.name}
                        </p>
                        {product.description && (
                          <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        <p className="font-mono text-sm font-bold text-forest mt-1">
                          {formatCurrency(product.price)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))
        )}
      </div>

      <footer className="max-w-lg mx-auto px-4 py-6 text-center">
        <p className="text-xs text-neutral-400">
          Dibuat dengan Rakku — {menu.outletName}
        </p>
      </footer>
    </main>
  );
}