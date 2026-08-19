import Image from "next/image";

const ingredients = [
  ["bean", "Espresso Beans", "5.000 gram tersedia", "18 gram"],
  ["milk", "Susu UHT", "20.000 ml tersedia", "150 ml"],
  ["cup", "Cup 16oz", "380 pcs tersedia", "1 pcs"],
] as const;

export function RecipeBoard() {
  return (
    <div className="recipe-board" aria-label="Contoh konfigurasi resep produk dan stok bahan baku">
      <div className="flex items-center justify-between gap-3 border-b border-[#e1e6da] px-4 py-3 font-mono text-[0.5rem] tracking-[0.06em] text-[#849188] sm:px-5">
        <span>PRODUCT / EDIT</span>
        <b className="ml-auto font-medium tracking-normal text-green-800">products / edit</b>
        <span className="rounded bg-[#e5f0dd] px-1.5 py-1 text-green-700">Aktif</span>
      </div>

      <div className="flex items-center gap-2 border-b border-[#e5e9e2] bg-white px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eef2eb] text-sm text-[#617267]" aria-hidden="true">
          ←
        </span>
        <div className="min-w-0 flex-1">
          <span className="block font-mono text-[0.42rem] uppercase tracking-[0.08em] text-[#809087]">Edit Produk</span>
          <h3 className="my-1 truncate font-sans text-sm font-semibold tracking-[-0.035em] text-green-900 sm:text-base">Kopi Susu Gula Aren</h3>
          <p className="truncate text-[0.43rem] text-[#8a948e] sm:text-[0.5rem]">Konfigurasi untuk sistem inventory dan POS</p>
        </div>
        <span className="shrink-0 rounded bg-[#2e7d32] px-2 py-1.5 font-mono text-[0.42rem] text-white">Simpan</span>
      </div>

      <div className="recipe-editor-grid">
        <div className="product-info-panel">
          <div className="product-placeholder">
            <Image src="/images/kopsuaren.webp" alt="Kopi Susu Gula Aren" fill sizes="120px" />
          </div>
          <div className="field-preview">
            <span>Status Produk</span>
            <b className="field-active">Aktif</b>
          </div>
          <div className="field-preview">
            <span>Nama Produk</span>
            <strong>Kopi Susu Gula Aren</strong>
          </div>
          <div className="field-preview">
            <span>Kategori</span>
            <strong>Coffee</strong>
          </div>
        </div>

        <div className="recipe-panel">
          <div className="mb-2.5 flex items-start justify-between gap-2.5">
            <div>
              <strong className="block text-xs text-green-900">Resep / Bahan Baku</strong>
              <small className="mt-1 block text-[0.43rem] text-[#89948b]">Bahan terpakai per 1 porsi produk ini</small>
            </div>
            <span className="whitespace-nowrap font-mono text-[0.4rem] font-bold text-[#2e7d32]">Kelola Resep</span>
          </div>

          <div className="recipe-rows">
            {ingredients.map(([tone, name, stock, amount]) => (
              <div key={name} className="recipe-row">
                <div>
                  <i className={`ingredient-dot ${tone}`} />
                  <span>
                    <strong>{name}</strong>
                    <small>{stock}</small>
                  </span>
                </div>
                <b>{amount}</b>
                <em>Aktif</em>
              </div>
            ))}
          </div>

          <div className="stock-sync">
            <span className="sync-dot animate-sync-pulse" />
            <div>
              <strong>Stok mengikuti penjualan</strong>
              <small>Otomatis berkurang setelah order selesai</small>
            </div>
            <b>HPP Rp 8.450</b>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#e1e6da] px-3 py-2.5 font-mono text-[0.4rem] text-[#849188] sm:px-5">
        <span>
          <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#69a85a]" /> Resep tersimpan untuk 1 porsi
        </span>
        <span className="text-sm text-green-700">↗</span>
      </div>
    </div>
  );
}
