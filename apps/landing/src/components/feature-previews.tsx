import Image from "next/image";

const recipeIngredients = [
  ["Espresso", "18 g"],
  ["Fresh Milk", "120 ml"],
  ["Gula Aren", "20 ml"],
  ["Ice", "100 g"],
] as const;

export function CashierFeaturePreview() {
  return (
    <div className="overflow-hidden rounded-md border border-green-950/10 bg-[#f7f9f4]" aria-label="Contoh tampilan POS kasir">
      <div className="flex items-center justify-between gap-3 border-b border-green-950/10 bg-ivory px-3 py-2.5 font-mono text-[0.52rem] uppercase tracking-[0.1em] text-green-900/50">
        <span>POS / Register</span>
        <span className="text-green-700">Contoh transaksi</span>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-mono text-[0.52rem] uppercase tracking-[0.1em] text-green-900/45">Menu</span>
            <span className="text-[0.58rem] text-green-900/45">6 item</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-green-700 bg-ivory p-1.5">
              <div className="relative aspect-[1.2] overflow-hidden rounded-[0.25rem] bg-[#e7efe0]">
                <Image src="/images/kopsuaren.webp" alt="Kopi Susu Gula Aren" fill sizes="140px" className="object-contain p-1" />
              </div>
              <strong className="mt-1.5 block truncate text-[0.62rem] font-semibold text-green-950">Kopi Susu Gula Aren</strong>
              <span className="mt-1 block font-mono text-[0.54rem] font-semibold text-green-700">Rp 24.000</span>
            </div>
            <div className="rounded border border-green-950/10 bg-ivory p-1.5">
              <div className="relative aspect-[1.2] overflow-hidden rounded-[0.25rem] bg-[#e7efe0]">
                <Image src="/images/croissant.webp" alt="Butter Croissant" fill sizes="140px" className="object-contain p-1" />
              </div>
              <strong className="mt-1.5 block truncate text-[0.62rem] font-semibold text-green-950">Butter Croissant</strong>
              <span className="mt-1 block font-mono text-[0.54rem] font-semibold text-green-700">Rp 18.000</span>
            </div>
          </div>
        </div>
        <aside className="flex flex-col rounded bg-green-950 p-3 text-ivory">
          <span className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-ivory/55">Order baru</span>
          <strong className="mt-1 text-[0.72rem] tracking-[-0.02em]">2 item</strong>
          <div className="mt-3 space-y-2 border-y border-ivory/15 py-3 text-[0.58rem]">
            <div className="flex justify-between gap-2"><span className="truncate text-ivory/60">Kopi Susu</span><span className="font-mono text-ivory">24k</span></div>
            <div className="flex justify-between gap-2"><span className="truncate text-ivory/60">Croissant</span><span className="font-mono text-ivory">18k</span></div>
          </div>
          <div className="mt-auto flex justify-between gap-2 pt-3 text-[0.62rem] font-semibold"><span>Total</span><span className="font-mono text-lime">Rp 42k</span></div>
        </aside>
      </div>
    </div>
  );
}

export function RecipeFeaturePreview() {
  return (
    <div className="overflow-hidden rounded-md border border-green-950/10 bg-ivory" aria-label="Contoh daftar resep dan bahan baku">
      <div className="flex items-start justify-between gap-3 border-b border-green-950/10 px-3 py-3">
        <div>
          <span className="block font-mono text-[0.52rem] uppercase tracking-[0.1em] text-green-900/45">Produk / Resep</span>
          <strong className="mt-1 block text-[0.82rem] font-semibold tracking-[-0.03em] text-green-950">Kopi Susu Gula Aren</strong>
        </div>
        <span className="rounded bg-[#e4f1df] px-2 py-1 font-mono text-[0.5rem] font-semibold text-green-700">4 bahan</span>
      </div>
      <div className="divide-y divide-green-950/10 px-3">
        {recipeIngredients.map(([name, amount], index) => (
          <div key={name} className="flex items-center justify-between gap-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${index === 0 ? "bg-green-700" : "bg-green-300"}`} />
              <span className="truncate text-[0.66rem] font-semibold text-green-950">{name}</span>
            </div>
            <span className="shrink-0 font-mono text-[0.58rem] text-green-700">{amount}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-green-950/10 bg-[#edf6e9] px-3 py-2.5 text-[0.56rem]">
        <span className="flex min-w-0 items-center gap-2 text-green-700"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" /> <span className="truncate">Stok mengikuti penjualan</span></span>
        <span className="shrink-0 font-mono font-semibold text-green-950">Per porsi</span>
      </div>
    </div>
  );
}

export function OwnerFeaturePreview() {
  return (
    <div className="overflow-hidden rounded-md border border-green-950/10 bg-ivory" aria-label="Contoh laporan laba rugi owner">
      <div className="flex items-center justify-between gap-3 border-b border-green-950/10 px-3 py-3">
        <div>
          <span className="block font-mono text-[0.52rem] uppercase tracking-[0.1em] text-green-900/45">Laporan / Laba rugi</span>
          <strong className="mt-1 block text-[0.82rem] font-semibold tracking-[-0.03em] text-green-950">Hari ini</strong>
        </div>
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.08em] text-green-700">Contoh data</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-green-950/10">
        <div className="bg-ivory px-3 py-3">
          <span className="block text-[0.55rem] text-green-900/50">Total omzet</span>
          <strong className="mt-1 block font-mono text-[0.72rem] text-green-800">Rp 2,84 jt</strong>
        </div>
        <div className="bg-ivory px-3 py-3">
          <span className="block text-[0.55rem] text-green-900/50">Total HPP</span>
          <strong className="mt-1 block font-mono text-[0.72rem] text-green-950">Rp 1,62 jt</strong>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-green-950/10 px-3 py-3">
        <span className="text-[0.62rem] font-semibold text-green-950">Laba bersih</span>
        <span className="font-mono text-[0.7rem] font-bold text-green-700">Rp 1,22 jt</span>
      </div>
    </div>
  );
}
