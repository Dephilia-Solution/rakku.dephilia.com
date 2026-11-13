import { recipeExample } from "@/content/product-story";

export function RecipeBoard() {
  return (
    <div className="recipe-board overflow-hidden rounded-xl border border-neutral-200 bg-surface-container-lowest" aria-label="Contoh pemakaian bahan untuk dua Kopi Susu Gula Aren">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <span className="block text-[0.62rem] text-on-surface-variant">Contoh resep produk</span>
          <h3 className="mt-1 truncate text-base font-semibold tracking-[-0.035em] text-on-surface sm:text-lg">{recipeExample.productName}</h3>
        </div>
        <span className="shrink-0 rounded-lg bg-primary-50 px-2.5 py-2 text-[0.56rem] font-semibold text-primary">{recipeExample.portions} porsi</span>
      </div>

      <div className="bg-neutral-50 p-4 sm:p-5">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <strong className="block text-sm font-semibold text-on-surface sm:text-base">Pemakaian bahan</strong>
            <small className="mt-1 block text-[0.62rem] text-on-surface-variant sm:text-[0.68rem]">Takaran resep × jumlah porsi terjual</small>
          </div>
          <span className="shrink-0 font-mono text-[0.56rem] font-bold text-primary">{recipeExample.ingredients.length} bahan</span>
        </div>

        <div className="space-y-2">
          {recipeExample.ingredients.map((ingredient) => (
            <div key={ingredient.name} className="landing-recipe-row flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-3.5 sm:px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0">
                  <strong className="block truncate text-[0.72rem] text-on-surface sm:text-[0.78rem]">{ingredient.name}</strong>
                  <small className="mt-0.5 block truncate text-[0.58rem] text-on-surface-variant sm:text-[0.62rem]">{ingredient.perPortion} {ingredient.unit} × {recipeExample.portions} porsi</small>
                </span>
              </div>
              <span className="shrink-0 font-mono text-[0.64rem] font-semibold text-on-surface sm:text-[0.7rem]">{ingredient.perPortion * recipeExample.portions} {ingredient.unit}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-xl border border-primary/15 bg-primary-50 px-3 py-3 sm:px-4">
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0 flex-1">
            <strong className="block text-[0.68rem] text-primary sm:text-[0.74rem]">36 g kopi + 300 ml susu</strong>
            <small className="mt-0.5 block text-[0.58rem] leading-[1.45] text-on-surface-variant sm:text-[0.62rem]">Pemakaian seluruh bahan tercatat saat transaksi selesai.</small>
          </div>
          <b className="shrink-0 font-mono text-[0.58rem] text-on-surface sm:text-[0.64rem]">Terhubung</b>
        </div>
      </div>
    </div>
  );
}
