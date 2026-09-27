import Image from "next/image";

const recipeIngredients = [
  ["Espresso", "18 g"],
  ["Fresh Milk", "120 ml"],
  ["Gula Aren", "20 ml"],
  ["Ice", "100 g"],
] as const;

export function CashierFeaturePreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50" aria-label="Contoh tampilan POS kasir">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-3 py-2.5 text-[0.52rem] text-neutral-500">
        <span className="font-semibold text-neutral-900">Kasir</span>
        <span>Outlet Kemang</span>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="min-w-0">
          <div className="flex min-h-8 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 text-[0.52rem] text-neutral-400">
            <span className="h-2.5 w-2.5 rounded-full border border-neutral-300" aria-hidden="true" />
            <span>Cari produk...</span>
          </div>
          <div className="mt-2 flex gap-1 overflow-hidden whitespace-nowrap text-[0.48rem] font-medium">
            <span className="rounded-full bg-forest px-2.5 py-1 text-white">All Items</span>
            <span className="rounded-full px-2.5 py-1 text-neutral-600">Coffee</span>
            <span className="rounded-full px-2.5 py-1 text-neutral-600">Pastry</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-2 ring-primary-500">
              <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                <Image src="/images/kopsuaren.webp" alt="Kopi Susu Gula Aren" fill sizes="140px" className="object-cover" />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.42rem] font-medium text-amber-800">Coffee</span>
              </div>
              <div className="p-1.5">
                <strong className="block truncate text-[0.58rem] font-semibold text-neutral-900">Kopi Susu Gula Aren</strong>
                <span className="mt-1 block font-mono text-[0.52rem] font-semibold text-forest">Rp 24.000</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                <Image src="/images/croissant.webp" alt="Butter Croissant" fill sizes="140px" className="object-cover" />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[0.42rem] font-medium text-orange-800">Pastry</span>
              </div>
              <div className="p-1.5">
                <strong className="block truncate text-[0.58rem] font-semibold text-neutral-900">Butter Croissant</strong>
                <span className="mt-1 block font-mono text-[0.52rem] font-semibold text-forest">Rp 18.000</span>
              </div>
            </div>
          </div>
        </div>
        <aside className="flex flex-col rounded-xl border border-neutral-200 bg-white p-3 text-neutral-900" aria-label="Contoh order berjalan">
          <div className="flex items-start justify-between gap-2 border-b border-neutral-200 pb-2">
            <div>
              <span className="block text-[0.48rem] text-neutral-400">Current Order</span>
              <strong className="mt-1 block text-[0.72rem]">2 item</strong>
            </div>
            <span className="grid h-6 w-6 place-items-center rounded-lg border border-forest/40 text-[0.52rem] font-semibold text-forest">2</span>
          </div>
          <div className="mt-2 space-y-2 border-b border-neutral-200 pb-2 text-[0.55rem]">
            <div className="flex justify-between gap-2"><span className="truncate text-neutral-600">Kopi Susu</span><span className="font-mono text-forest">24k</span></div>
            <div className="flex justify-between gap-2"><span className="truncate text-neutral-600">Croissant</span><span className="font-mono text-forest">18k</span></div>
          </div>
          <div className="mt-auto flex justify-between gap-2 pt-2 text-[0.6rem] font-bold text-neutral-900"><span>Total</span><span className="font-mono">Rp 42k</span></div>
          <div className="mt-2 rounded-xl bg-forest px-2 py-2 text-center text-[0.52rem] font-semibold text-white">Payment</div>
        </aside>
      </div>
    </div>
  );
}

export function RecipeFeaturePreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-surface-container-lowest" aria-label="Contoh daftar resep dan bahan baku">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-3 py-3">
        <div>
          <span className="block text-[0.52rem] text-on-surface-variant">Produk aktif</span>
          <strong className="mt-1 block text-[0.82rem] font-semibold tracking-[-0.03em] text-on-surface">Kopi Susu Gula Aren</strong>
        </div>
        <span className="rounded-lg bg-primary-50 px-2 py-1 text-[0.5rem] font-semibold text-primary">4 bahan</span>
      </div>
      <div className="space-y-2 bg-neutral-50 p-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <strong className="block text-[0.72rem] font-semibold text-on-surface">Resep / Bahan Baku</strong>
            <small className="mt-1 block text-[0.56rem] text-on-surface-variant">Bahan per 1 porsi produk</small>
          </div>
          <span className="shrink-0 font-mono text-[0.5rem] font-semibold text-primary">Per porsi</span>
        </div>
        <div className="space-y-2">
          {recipeIngredients.map(([name, amount]) => (
            <div key={name} className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="truncate text-[0.66rem] font-semibold text-on-surface">{name}</span>
              </div>
              <span className="shrink-0 font-mono text-[0.58rem] text-on-surface-variant">{amount}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary-50 px-3 py-2.5 text-[0.54rem]">
          <span className="flex min-w-0 items-center gap-2 text-primary"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> <span className="truncate">Stok mengikuti penjualan</span></span>
          <span className="shrink-0 font-mono font-semibold text-on-surface">Terhubung</span>
        </div>
      </div>
    </div>
  );
}

export function OwnerFeaturePreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-surface-container-lowest" aria-label="Contoh laporan laba rugi owner">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-3 py-3">
        <div>
          <span className="block text-[0.52rem] text-on-surface-variant">Laporan / Laba rugi</span>
          <strong className="mt-1 block text-[0.82rem] font-semibold tracking-[-0.03em] text-on-surface">Hari ini</strong>
        </div>
        <span className="text-[0.5rem] font-medium text-primary">Contoh data</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-neutral-200">
        <div className="bg-white px-3 py-3">
          <span className="block text-[0.55rem] text-on-surface-variant">Total omzet</span>
          <strong className="mt-1 block font-mono text-[0.72rem] text-forest">Rp 2,84 jt</strong>
        </div>
        <div className="bg-white px-3 py-3">
          <span className="block text-[0.55rem] text-on-surface-variant">Total HPP</span>
          <strong className="mt-1 block font-mono text-[0.72rem] text-on-surface">Rp 1,62 jt</strong>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-3 py-3">
        <span className="text-[0.62rem] font-semibold text-on-surface">Laba bersih</span>
        <span className="font-mono text-[0.7rem] font-bold text-forest">Rp 1,22 jt</span>
      </div>
    </div>
  );
}
