import Image from "next/image";

const ingredients = [
  { name: "Espresso", stock: "1.240 g tersedia", quantity: "18 g", tone: "bg-[#9b6b48]" },
  { name: "Fresh Milk", stock: "8.400 ml tersedia", quantity: "120 ml", tone: "bg-[#bddbb0]" },
  { name: "Gula Aren", stock: "2.100 ml tersedia", quantity: "20 ml", tone: "bg-[#d3b27e]" },
  { name: "Ice", stock: "18.000 g tersedia", quantity: "100 g", tone: "bg-[#d8e1d4]" },
] as const;

export function RecipeBoard() {
  return (
    <div className="recipe-board" aria-label="Contoh konfigurasi resep produk dan stok bahan baku">
      <div className="flex items-center justify-between gap-3 border-b border-[#e1e6da] px-4 py-3 font-mono text-[0.56rem] uppercase tracking-[0.08em] text-[#849188] sm:px-5">
        <span>Product / Edit</span>
        <span className="ml-auto font-medium tracking-normal text-green-800">Contoh data</span>
        <span className="rounded bg-[#e5f0dd] px-1.5 py-1 text-green-700">Aktif</span>
      </div>

      <div className="flex items-center gap-3 border-b border-[#e5e9e2] bg-white px-4 py-4 sm:px-6">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#eef2eb] text-lg text-[#617267]" aria-hidden="true">r</div>
        <div className="min-w-0 flex-1">
          <span className="block font-mono text-[0.52rem] uppercase tracking-[0.1em] text-[#809087]">Produk aktif</span>
          <h3 className="mt-1 truncate font-sans text-base font-semibold tracking-[-0.035em] text-green-900 sm:text-lg">Kopi Susu Gula Aren</h3>
          <p className="mt-1 truncate text-[0.62rem] text-[#8a948e] sm:text-[0.68rem]">Konfigurasi untuk sistem inventory dan POS</p>
        </div>
        <span className="shrink-0 rounded bg-[#2e7d32] px-2.5 py-2 font-mono text-[0.56rem] font-semibold text-white">Tersimpan</span>
      </div>

      <div className="grid gap-5 bg-[#f7f9f5] p-4 sm:p-6 lg:grid-cols-[minmax(10rem,0.68fr)_minmax(0,1.32fr)]">
        <div className="min-w-0">
          <div className="relative aspect-[1.18] overflow-hidden rounded-md border border-[#dfe7db] bg-[#e6efdf]">
            <Image src="/images/kopsuaren.webp" alt="Kopi Susu Gula Aren" fill sizes="(max-width: 1024px) 100vw, 180px" className="object-contain p-2" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded border border-[#e3e9df] bg-white p-2.5">
              <span className="block font-mono text-[0.52rem] uppercase tracking-[0.08em] text-[#89948b]">Resep</span>
              <strong className="mt-1 block text-[0.76rem] text-green-900">4 bahan</strong>
            </div>
            <div className="rounded border border-[#e3e9df] bg-white p-2.5">
              <span className="block font-mono text-[0.52rem] uppercase tracking-[0.08em] text-[#89948b]">HPP</span>
              <strong className="mt-1 block font-mono text-[0.68rem] text-green-700">Rp 8.450</strong>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <strong className="block text-sm text-green-900 sm:text-base">Resep / Bahan Baku</strong>
              <small className="mt-1 block text-[0.62rem] text-[#89948b] sm:text-[0.68rem]">Bahan terpakai per 1 porsi produk ini</small>
            </div>
            <span className="whitespace-nowrap font-mono text-[0.56rem] font-bold text-[#2e7d32]">Per 1 porsi</span>
          </div>

          <div className="overflow-hidden rounded-md border border-[#e1e7df] bg-white">
            {ingredients.map((ingredient) => (
              <div key={ingredient.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#edf0eb] px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${ingredient.tone}`} />
                  <span className="min-w-0">
                    <strong className="block truncate text-[0.72rem] text-green-900 sm:text-[0.78rem]">{ingredient.name}</strong>
                    <small className="mt-0.5 block truncate text-[0.58rem] text-[#89948b] sm:text-[0.62rem]">{ingredient.stock}</small>
                  </span>
                </div>
                <b className="font-mono text-[0.64rem] text-green-950 sm:text-[0.7rem]">{ingredient.quantity}</b>
                <span className="hidden rounded bg-[#e4f1df] px-2 py-1 font-mono text-[0.52rem] font-semibold text-green-700 sm:inline-flex">Aktif</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-md border border-[#d9e8d1] bg-[#edf6e9] px-3 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#5da04c]" />
            <div className="min-w-0 flex-1">
              <strong className="block text-[0.68rem] text-green-700 sm:text-[0.74rem]">Stok mengikuti penjualan</strong>
              <small className="mt-0.5 block text-[0.58rem] leading-[1.45] text-[#7d8d80] sm:text-[0.62rem]">Otomatis berkurang setelah order selesai</small>
            </div>
            <b className="shrink-0 font-mono text-[0.58rem] text-green-950 sm:text-[0.64rem]">Terhubung</b>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e1e6da] px-4 py-3 font-mono text-[0.54rem] uppercase tracking-[0.08em] text-[#849188] sm:px-6">
        <span>Product <i className="mx-1 not-italic text-green-700">→</i> Recipe <i className="mx-1 not-italic text-green-700">→</i> Stock</span>
        <span className="text-green-700">Resep tersimpan</span>
      </div>
    </div>
  );
}
