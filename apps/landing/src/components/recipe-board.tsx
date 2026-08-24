const ingredients = [
  { name: "Espresso", stock: "1.240 g tersedia", quantity: "18 g" },
  { name: "Fresh Milk", stock: "8.400 ml tersedia", quantity: "120 ml" },
  { name: "Gula Aren", stock: "2.100 ml tersedia", quantity: "20 ml" },
  { name: "Ice", stock: "18.000 g tersedia", quantity: "100 g" },
] as const;

export function RecipeBoard() {
  return (
    <div className="recipe-board overflow-hidden rounded-xl border border-neutral-200 bg-surface-container-lowest" aria-label="Contoh daftar resep produk dan stok bahan baku">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <span className="block text-[0.62rem] text-on-surface-variant">Produk aktif</span>
          <h3 className="mt-1 truncate text-base font-semibold tracking-[-0.035em] text-on-surface sm:text-lg">Kopi Susu Gula Aren</h3>
        </div>
        <span className="shrink-0 rounded-lg bg-primary-50 px-2.5 py-2 text-[0.56rem] font-semibold text-primary">4 bahan</span>
      </div>

      <div className="bg-neutral-50 p-4 sm:p-5">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <strong className="block text-sm font-semibold text-on-surface sm:text-base">Resep / Bahan Baku</strong>
            <small className="mt-1 block text-[0.62rem] text-on-surface-variant sm:text-[0.68rem]">Bahan yang terpakai per 1 porsi produk ini</small>
          </div>
          <span className="shrink-0 font-mono text-[0.56rem] font-bold text-primary">Per 1 porsi</span>
        </div>

        <div className="space-y-2">
          {ingredients.map((ingredient) => (
            <div key={ingredient.name} className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-3.5 sm:px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0">
                  <strong className="block truncate text-[0.72rem] text-on-surface sm:text-[0.78rem]">{ingredient.name}</strong>
                  <small className="mt-0.5 block truncate text-[0.58rem] text-on-surface-variant sm:text-[0.62rem]">{ingredient.stock}</small>
                </span>
              </div>
              <span className="shrink-0 font-mono text-[0.64rem] font-semibold text-on-surface sm:text-[0.7rem]">{ingredient.quantity} / porsi</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-xl border border-primary/15 bg-primary-50 px-3 py-3 sm:px-4">
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0 flex-1">
            <strong className="block text-[0.68rem] text-primary sm:text-[0.74rem]">Stok tercukupi penjualan</strong>
            <small className="mt-0.5 block text-[0.58rem] leading-[1.45] text-on-surface-variant sm:text-[0.62rem]">Otomatis berkurang setelah order selesai</small>
          </div>
          <b className="shrink-0 font-mono text-[0.58rem] text-on-surface sm:text-[0.64rem]">Terhubung</b>
        </div>
      </div>
    </div>
  );
}
