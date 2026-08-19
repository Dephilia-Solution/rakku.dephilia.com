import { ArrowDownIcon, ArrowRightIcon, PlusIcon, SearchIcon } from "./icons";
import { HeroProductMenu } from "./hero-product-menu";
import { ButtonLink, HeroCopy, HeroVisual } from "./motion";
import { Container } from "./primitives";
import { ownerUrl } from "./site";

export function HeroPreview() {
  return (
    <div className="relative mx-auto flex min-h-[25rem] w-full max-w-[42rem] items-center justify-center [perspective:1200px] sm:min-h-[31rem]">
      <div className="sticker sticker-top animate-sticker-float">
        <span className="sticker-pulse animate-live-pulse" /> Live register
      </div>
      <div className="sticker sticker-bottom animate-sticker-float-reverse">
        <span className="sticker-spark">
          <PlusIcon className="h-3.5 w-3.5" />
        </span>
        Stok mengikuti resep
      </div>

      <div className="hero-window animate-hero-window-float relative z-10 overflow-hidden rounded-[0.55rem] border border-brand bg-ivory shadow-window">
        <div className="hero-window-bar">
          <div className="window-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="window-address">pos / register</span>
        </div>

        <div className="pos-shell">
          <aside className="pos-sidebar" aria-hidden="true">
            <div className="pos-brand-mark">r</div>
            <span className="pos-nav-item active" />
            <span className="pos-nav-item" />
            <span className="pos-nav-item" />
            <span className="pos-nav-item" />
            <span className="pos-nav-item" />
            <div className="pos-sidebar-avatar">rk</div>
          </aside>

          <div className="pos-workspace">
            <div className="pos-header">
              <div>
                <span className="pos-kicker">Outlet aktif</span>
                <strong>Kasir / Register</strong>
              </div>
            </div>

            <div className="pos-search">
              <SearchIcon className="h-4 w-4" />
              <span>Cari produk...</span>
              <kbd>K</kbd>
            </div>

            <div className="pos-content">
              <div className="pos-menu">
                <HeroProductMenu />
              </div>

              <aside className="pos-order mt-2" aria-label="Pesanan saat ini">
                <div className="pos-order-head">
                  <div>
                    <span className="pos-kicker">Order #2048</span>
                    <strong>Current Order</strong>
                  </div>
                  <span className="pos-order-count">2</span>
                </div>

                <div className="pos-customer">
                  <span>Nama Customer</span>
                  <b>Budi</b>
                </div>

                <div className="pos-order-list">
                  <div className="pos-order-item">
                    <div>
                      <strong>Kopi Susu Gula Aren</strong>
                      <small>Regular · 1x</small>
                    </div>
                    <b>Rp 24k</b>
                  </div>
                  <div className="pos-order-item">
                    <div>
                      <strong>Butter Croissant</strong>
                      <small>Original · 1x</small>
                    </div>
                    <b>Rp 18k</b>
                  </div>
                </div>

                <div className="pos-totals">
                  <span>
                    Subtotal <b>Rp 42.000</b>
                  </span>
                  <span>
                    Pajak <b>Rp 0</b>
                  </span>
                  <strong>
                    Total <b>Rp 42.000</b>
                  </strong>
                </div>

                <div className="pos-payment">
                  Payment
                  <span>
                    Rp 42k <b>→</b>
                  </span>
                </div>
              </aside>
            </div>

            <div className="mobile-order-bar">
              <span>2 item</span>
              <b>Rp 42.000</b>
              <strong>Detail →</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-paper pb-[clamp(3rem,5vw,4.5rem)] pt-4 sm:pt-6 lg:min-h-[40rem] lg:pt-[clamp(2rem,3.5vw,3.25rem)]">
      <Container className="relative z-10 grid items-center gap-4 lg:grid-cols-[minmax(0,0.86fr)_minmax(32rem,1.14fr)] lg:gap-10">
        <HeroCopy className="relative z-20 py-5 lg:py-8">
          <h1 className="max-w-[38.75rem] font-display text-[clamp(3.25rem,6.4vw,5.7rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-green-950">
            Dari kasir sampai laba, semua <em className="not-italic text-green-700">tersusun rapi.</em>
          </h1>
          <p className="mt-5 max-w-[31.875rem] text-[clamp(1rem,1.6vw,1.125rem)] leading-[1.62] text-muted">
            Rakku menyatukan transaksi, stok bahan baku, resep, outlet, dan laporan laba rugi supaya Anda bisa mengurus bisnis tanpa kehilangan jejak.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href={`${ownerUrl}/register`} className="min-h-[3.375rem] bg-green-800 px-6 text-ivory shadow-[0_12px_26px_rgba(29,91,56,0.2)] hover:bg-green-950 hover:shadow-[0_14px_30px_rgba(16,44,29,0.24)]">
              Buat akun owner <ArrowRightIcon className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="#cara-kerja" className="min-h-[3.375rem] border-brand bg-transparent px-6 text-ink hover:border-green-800 hover:bg-ivory/50">
              Lihat cara kerja <ArrowDownIcon className="h-4 w-4" />
            </ButtonLink>
          </div>
        </HeroCopy>

        <HeroVisual className="relative mx-auto w-full max-w-[42.5rem] lg:min-h-[32rem]">
          <HeroPreview />
        </HeroVisual>
      </Container>

      <div className="pointer-events-none absolute right-[6%] top-[15%] hidden h-32 w-32 rotate-45 border border-green-700/20 lg:block" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 right-[37%] hidden h-56 w-56 rounded-full border border-green-700/20 lg:block" aria-hidden="true" />
    </section>
  );
}
