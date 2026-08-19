import Image from "next/image";

import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  SearchIcon,
} from "./icons";
import { MobileMenu } from "./mobile-menu";
import { ButtonLink, HeroCopy, HeroVisual, Lift, Stagger, StaggerItem } from "./motion";
import { ScrollReveal } from "./scroll-reveal";

const ownerUrl = "https://rakku.vercel.app";
const posUrl = "https://pos-rakku.vercel.app";

type ContainerProps = React.PropsWithChildren<{
  className?: string;
}>;

function Container({ children, className = "" }: ContainerProps) {
  return <div className={`landing-container ${className}`}>{children}</div>;
}

function SectionKicker({ children, light = false }: React.PropsWithChildren<{ light?: boolean }>) {
  return (
    <div
      className={`mb-5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${
        light ? "text-lime" : "text-green-700"
      }`}
    >
      <span className="text-coral">{String(children).split("/")[0]}</span>
      {String(children).includes("/") ? `/${String(children).split("/").slice(1).join("/")}` : null}
    </div>
  );
}

function TextLink({ href, children, light = false }: React.PropsWithChildren<{ href: string; light?: boolean }>) {
  return (
    <a
      href={href}
      className={`landing-link-underline inline-flex min-h-12 items-center gap-2 text-[0.8125rem] font-bold transition-colors duration-200 ${
        light ? "text-lime hover:text-ivory" : "text-green-800 hover:text-green-950"
      }`}
    >
      {children}
    </a>
  );
}

function Header() {
  const links = [
    ["Fitur", "#fitur"],
    ["Cara kerja", "#alur"],
    ["Untuk siapa", "#untuk-siapa"],
    ["FAQ", "#faq"],
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-brand bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <Container className="relative flex min-h-[4.75rem] items-center justify-between gap-4">
        <a href="#top" className="flex shrink-0 items-center gap-2.5" aria-label="Rakku, kembali ke atas">
          <Image src="/images/rakku_logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" priority />
          <Image src="/images/rakku_logotype.png" alt="Rakku" width={116} height={25} className="h-auto w-[clamp(5.9rem,10vw,7.25rem)] object-contain" priority />
        </a>

        <nav className="ml-auto hidden items-center gap-6 text-[0.8125rem] font-semibold text-muted md:flex" aria-label="Navigasi utama">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="landing-link-underline flex min-h-12 items-center transition-colors duration-200 hover:text-green-800">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-5">
          <a href={`${ownerUrl}/login`} className="landing-link-underline hidden min-h-12 items-center text-[0.8125rem] font-bold text-green-800 transition-colors duration-200 hover:text-green-950 sm:inline-flex">
            Masuk
          </a>
          <ButtonLink href={`${ownerUrl}/register`} className="min-h-11 bg-green-950 px-3.5 text-[0.7rem] text-ivory shadow-sm hover:bg-green-800 hover:shadow-lg sm:px-4 sm:text-[0.8125rem]">
            Mulai gratis
            <ArrowRightIcon className="h-4 w-4" />
          </ButtonLink>
          <MobileMenu links={links} ownerUrl={ownerUrl} />
        </div>
      </Container>
    </header>
  );
}

function ProductCard({ image, alt, category, name, price, tone }: { image: string; alt: string; category: string; name: string; price: string; tone: string }) {
  return (
    <article className="pos-product-card">
      <div className={`pos-product-image ${tone}`}>
        <Image src={image} alt={alt} fill sizes="(max-width: 767px) 35vw, 115px" />
      </div>
      <span className="pos-category">{category}</span>
      <strong>{name}</strong>
      <b>{price}</b>
    </article>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto flex min-h-[25rem] w-full max-w-[42rem] items-center justify-center [perspective:1200px] sm:min-h-[31rem]">
      <div className="sticker sticker-top"><span className="sticker-pulse" /> Live register</div>
      <div className="sticker sticker-bottom"><span className="sticker-spark">+</span> Stok mengikuti resep</div>
      <div className="hero-window relative z-10 overflow-hidden rounded-[0.55rem] border border-brand bg-ivory shadow-window">
        <div className="hero-window-bar">
          <div className="window-dots" aria-hidden="true"><span /><span /><span /></div>
          <span className="window-address">pos / register</span>
          <span className="window-status"><i /> Online</span>
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
              <div><span className="pos-kicker">Outlet aktif</span><strong>Kasir / Register</strong></div>
              <span className="pos-outlet"><i /> Tembalang</span>
            </div>
            <div className="pos-search"><SearchIcon className="h-4 w-4" /><span>Cari produk...</span><kbd>K</kbd></div>
            <div className="pos-categories"><span className="active">All Items</span><span>Coffee</span><span>Pastry</span><span>Non-Coffee</span></div>
            <div className="pos-content">
              <div className="pos-menu">
                <div className="pos-menu-heading"><strong>Produk</strong><small>5 tersedia</small></div>
                <div className="pos-products">
                  <ProductCard image="/images/kopsuaren.webp" alt="Kopi Susu Gula Aren" category="COFFEE" name="Kopi Susu Gula Aren" price="Rp 24.000" tone="product-coffee" />
                  <ProductCard image="/images/cafelatte.webp" alt="Cafe Latte" category="COFFEE" name="Cafe Latte" price="Rp 22.000" tone="product-latte" />
                  <ProductCard image="/images/croissant.webp" alt="Butter Croissant" category="PASTRY" name="Butter Croissant" price="Rp 18.000" tone="product-pastry" />
                  <ProductCard image="/images/espresso.webp" alt="Espresso" category="COFFEE" name="Espresso" price="Rp 16.000" tone="product-espresso" />
                </div>
              </div>
              <aside className="pos-order" aria-label="Pesanan saat ini">
                <div className="pos-order-head"><div><span className="pos-kicker">Order #2048</span><strong>Current Order</strong></div><span className="pos-order-count">2</span></div>
                <div className="pos-customer"><span>Nama Customer</span><b>Budi</b></div>
                <div className="pos-order-list">
                  <div className="pos-order-item"><div><strong>Kopi Susu Gula Aren</strong><small>Regular · 1x</small></div><b>Rp 24k</b></div>
                  <div className="pos-order-item"><div><strong>Butter Croissant</strong><small>Original · 1x</small></div><b>Rp 18k</b></div>
                </div>
                <div className="pos-totals"><span>Subtotal <b>Rp 42.000</b></span><span>Pajak <b>Rp 0</b></span><strong>Total <b>Rp 42.000</b></strong></div>
                <div className="pos-payment">Payment <span>Rp 42k <b>→</b></span></div>
              </aside>
            </div>
            <div className="mobile-order-bar"><span>2 item</span><b>Rp 42.000</b><strong>Detail →</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-paper pb-[clamp(3rem,5vw,4.5rem)] pt-4 sm:pt-6 lg:min-h-[40rem] lg:pt-[clamp(2rem,3.5vw,3.25rem)]">
      <Container className="relative z-10 grid items-center gap-4 lg:grid-cols-[minmax(0,0.86fr)_minmax(32rem,1.14fr)] lg:gap-10">
        <HeroCopy className="relative z-20 py-5 lg:py-8">
          <div className="mb-4 inline-flex items-center gap-2.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-green-800 sm:text-xs"><span className="h-2 w-2 rounded-full bg-coral shadow-[0_0_0_5px_rgba(216,121,89,0.15)]" /> Sistem operasi untuk kedai kecil &amp; cafe</div>
          <h1 className="max-w-[38.75rem] font-display text-[clamp(3.25rem,6.4vw,5.7rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-green-950">Dari kasir sampai laba, semua <em className="not-italic text-green-700">tersusun rapi.</em></h1>
          <p className="mt-5 max-w-[31.875rem] text-[clamp(1rem,1.6vw,1.125rem)] leading-[1.62] text-muted">Rakku menyatukan transaksi, stok bahan baku, resep, outlet, dan laporan laba rugi supaya Anda bisa mengurus bisnis tanpa kehilangan jejak.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href={`${ownerUrl}/register`} className="min-h-[3.375rem] bg-green-800 px-6 text-ivory shadow-[0_12px_26px_rgba(29,91,56,0.2)] hover:bg-green-950 hover:shadow-[0_14px_30px_rgba(16,44,29,0.24)]">Buat akun owner <ArrowRightIcon className="h-4 w-4" /></ButtonLink>
            <ButtonLink href="#cara-kerja" className="min-h-[3.375rem] border-brand bg-transparent px-6 text-ink hover:border-green-800 hover:bg-ivory/50">Lihat cara kerja <ArrowDownIcon className="h-4 w-4" /></ButtonLink>
          </div>
          <div className="mt-5 flex items-start gap-2.5 text-xs text-muted"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime text-[0.7rem] font-bold text-green-950"><CheckIcon className="h-3.5 w-3.5" /></span><span>Mulai dari satu outlet. Tumbuh tanpa memindahkan data.</span></div>
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

function SignalStrip() {
  return (
    <section className="border-y border-green-950/10 bg-green-950 text-ivory" aria-label="Area kerja Rakku">
      <Container className="flex min-h-[4.25rem] flex-col items-start justify-center gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:py-0">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.07em] text-ivory/60">Satu alur kerja untuk</span>
        <div className="flex items-center gap-3 font-display text-base text-lime sm:gap-3.5 sm:text-lg"><span>Kasir</span><i className="h-1 w-1 rounded-full bg-coral" /><span>Stok</span><i className="h-1 w-1 rounded-full bg-coral" /><span>Resep</span><i className="h-1 w-1 rounded-full bg-coral" /><span>Outlet</span><i className="h-1 w-1 rounded-full bg-coral" /><span>Laba</span></div>
        <span className="hidden text-right font-mono text-[0.6rem] uppercase tracking-[0.07em] text-ivory/60 sm:block">bukan lima spreadsheet terpisah.</span>
      </Container>
    </section>
  );
}

function Problem() {
  const points = [
    "Owner melihat apa yang terjadi di tiap outlet, tanpa harus selalu berada di sana.",
    "Kasir bekerja cepat dengan POS yang fokus pada pesanan, meja, dan pembayaran.",
    "Stok dan HPP mengikuti resep, bukan perkiraan di akhir bulan.",
  ];

  return (
    <ScrollReveal className="bg-paper py-[clamp(3.5rem,6vw,5.5rem)]" id="kenapa-rakku">
      <Stagger className="landing-container grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-[clamp(3rem,7vw,5.5rem)]">
        <StaggerItem>
          <SectionKicker>01 / Kenapa Rakku</SectionKicker>
          <h2 className="max-w-[12ch] font-display text-[clamp(2.45rem,4.5vw,4.05rem)] font-semibold leading-[1.02] text-green-950">Bisnis Anda bergerak cepat. Sistemnya harus ikut.</h2>
        </StaggerItem>
        <StaggerItem className="pt-0 lg:pt-8">
          <p className="max-w-[37.5rem] font-display text-[clamp(1.35rem,2.2vw,1.6rem)] leading-[1.25] tracking-[-0.025em] text-green-900">Kedai kecil tidak butuh software yang terasa seperti ERP. Anda butuh satu tempat yang mengerti ritme buka toko, antrean kasir, bahan yang berkurang, dan keputusan yang harus dibuat sebelum jam ramai.</p>
          <div className="mt-9 grid gap-4">
            {points.map((point, index) => (
              <div key={point} className="grid grid-cols-[2.6rem_1fr] gap-3 border-t border-brand pt-4">
                <span className="font-mono text-[0.65rem] text-coral">0{index + 1}</span>
                <p className="m-0 max-w-[26.875rem] text-sm leading-[1.6] text-muted">{point}</p>
              </div>
            ))}
          </div>
        </StaggerItem>
      </Stagger>
    </ScrollReveal>
  );
}

function ProfitVisual() {
  return <div className="profit-visual" aria-hidden="true"><span className="profit-arrow">↗</span><span className="profit-number">33,6%</span><span className="profit-label">margin terlihat</span></div>;
}

function OutletVisual() {
  return <div className="outlet-visual" aria-hidden="true"><span className="outlet-node main-node">R</span><span className="outlet-line line-a" /><span className="outlet-line line-b" /><span className="outlet-node node-a">T</span><span className="outlet-node node-b">B</span><span className="outlet-node node-c">P</span></div>;
}

function FeatureCard({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return <Lift className={`landing-card flex h-full min-h-[20.5rem] flex-col items-start overflow-hidden rounded-lg border border-brand p-6 ${className}`}>{children}</Lift>;
}

function Features() {
  return (
    <ScrollReveal className="bg-paper-deep py-[clamp(3.5rem,6vw,5.5rem)]" id="fitur">
      <Container>
        <Stagger className="mb-10 flex flex-col gap-6 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
          <StaggerItem><div><SectionKicker>02 / Yang Anda dapatkan</SectionKicker><h2 className="font-display text-[clamp(2.45rem,4.5vw,4.05rem)] font-semibold leading-[1.02] text-green-950">Kerja harian lebih ringan.<br /><em className="not-italic text-green-700">Keputusan lebih tajam.</em></h2></div></StaggerItem>
          <StaggerItem><p className="m-0 max-w-[18.75rem] text-sm leading-[1.65] text-muted">Fitur Rakku dirancang dari alur nyata kedai dan cafe kecil, dari produk pertama sampai laporan laba rugi.</p></StaggerItem>
        </Stagger>
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StaggerItem className="sm:col-span-2">
          <FeatureCard className="bg-green-950 text-ivory hover:shadow-xl">
            <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ivory/70">A / Kasir</div>
            <div className="landing-feature-image" aria-hidden="true"><Image src="/images/struk.png" alt="" fill sizes="130px" /></div>
            <h3 className="mt-5 max-w-[16.25rem] font-display text-[clamp(1.5rem,2.2vw,1.65rem)] font-semibold leading-[1.08] text-lime">Transaksi tanpa menghambat antrean.</h3>
            <p className="m-0 max-w-[18.5rem] text-[0.8125rem] leading-[1.58] text-ivory/65">Register yang cepat untuk produk, modifier, tier harga, meja, pembayaran, split bill, dan invoice.</p>
            <div className="mt-auto w-full border-t border-ivory/20 pt-3 font-mono text-[0.5rem] text-ivory/60">Dine in / Take away / QRIS / Tunai</div>
          </FeatureCard>
          </StaggerItem>
          <StaggerItem>
          <FeatureCard className="bg-lime text-green-950 hover:shadow-xl">
            <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-green-900/80">B / Inventory</div>
            <div className="landing-feature-image inventory" aria-hidden="true"><Image src="/images/inventory.png" alt="" fill sizes="140px" /></div>
            <h3 className="mt-5 max-w-[16.25rem] font-display text-[clamp(1.5rem,2.2vw,1.65rem)] font-semibold leading-[1.08]">Bahan baku yang ikut bergerak.</h3>
            <p className="m-0 max-w-[18.5rem] text-[0.8125rem] leading-[1.58] text-green-900/75">Hubungkan produk ke resep. Setiap order selesai, stok berkurang dan jejaknya tersimpan.</p>
          </FeatureCard>
          </StaggerItem>
          <StaggerItem>
          <FeatureCard className="bg-ivory/50 hover:shadow-xl">
            <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">C / Owner</div>
            <ProfitVisual />
            <h3 className="mt-5 max-w-[16.25rem] font-display text-[clamp(1.5rem,2.2vw,1.65rem)] font-semibold leading-[1.08] text-green-950">Laba, bukan sekadar omzet.</h3>
            <p className="m-0 max-w-[18.5rem] text-[0.8125rem] leading-[1.58] text-muted">Lihat omzet, HPP, pengeluaran, laba kotor, dan laba bersih dalam satu laporan.</p>
          </FeatureCard>
          </StaggerItem>
          <StaggerItem className="sm:col-span-2">
          <FeatureCard className="bg-ivory/50 hover:shadow-xl">
            <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">D / Multi-outlet</div>
            <OutletVisual />
            <h3 className="mt-5 max-w-[16.25rem] font-display text-[clamp(1.5rem,2.2vw,1.65rem)] font-semibold leading-[1.08] text-green-950">Satu pemilik. Banyak outlet. Tetap terarah.</h3>
            <p className="m-0 max-w-[18.5rem] text-[0.8125rem] leading-[1.58] text-muted">Kelola outlet, karyawan, produk, akses menu, dan laporan dalam konteks yang jelas per cabang.</p>
          </FeatureCard>
          </StaggerItem>
          <StaggerItem>
          <FeatureCard className="bg-green-950 text-ivory hover:shadow-xl">
            <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ivory/70">E / Akses</div>
            <div className="roles-visual" aria-hidden="true"><span>Owner</span><span>Admin</span><span>Kasir</span></div>
            <h3 className="mt-5 max-w-[16.25rem] font-display text-[clamp(1.5rem,2.2vw,1.65rem)] font-semibold leading-[1.08] text-lime">Setiap orang melihat yang perlu.</h3>
            <p className="m-0 max-w-[18.5rem] text-[0.8125rem] leading-[1.58] text-ivory/65">Role dan akses menu dinamis untuk menjaga operasional tetap aman dan tidak membingungkan.</p>
          </FeatureCard>
          </StaggerItem>
          <StaggerItem className="sm:col-span-2">
          <FeatureCard className="bg-coral text-ivory hover:shadow-xl">
            <div className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ivory/80">F / QR Menu</div>
            <div className="qr-visual" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <span key={index} />)}</div>
            <h3 className="mt-5 max-w-[16.25rem] font-display text-[clamp(1.5rem,2.2vw,1.65rem)] font-semibold leading-[1.08]">Menu digital tanpa aplikasi.</h3>
            <p className="m-0 max-w-[18.5rem] text-[0.8125rem] leading-[1.58] text-ivory/80">Buat QR menu view-only untuk tiap outlet. Pelanggan cukup scan dan melihat katalog terbaru.</p>
          </FeatureCard>
          </StaggerItem>
        </Stagger>
      </Container>
    </ScrollReveal>
  );
}

function Workflow() {
  const steps = [
    {
      number: "01",
      title: "Buat outlet",
      description: "Daftar sebagai Owner, buat company, lalu mulai dari outlet pertama Anda.",
      visual: <div className="step-visual step-store" aria-hidden="true"><span className="store-roof" /><span className="store-body" /><span className="store-door" /></div>,
    },
    {
      number: "02",
      title: "Susun produk & resep",
      description: "Atur kategori, tier harga, modifier, bahan baku, dan resep produk.",
      visual: <div className="step-visual step-menu" aria-hidden="true"><span /><span /><span /><span /></div>,
    },
    {
      number: "03",
      title: "Kasir mulai berjualan",
      description: "Kasir login dengan alur cepat dan fokus menyelesaikan pesanan.",
      visual: <div className="step-visual step-pos" aria-hidden="true"><span className="pos-screen" /><span className="pos-button" /><span className="pos-button" /><span className="pos-button" /></div>,
    },
    {
      number: "04",
      title: "Pantau yang penting",
      description: "Gunakan data penjualan, stok, HPP, dan pengeluaran untuk mengambil keputusan.",
      visual: <div className="step-visual step-report" aria-hidden="true"><span className="report-line line-one" /><span className="report-line line-two" /><span className="report-line line-three" /><span className="report-dot" /></div>,
    },
  ];

  return (
    <ScrollReveal className="bg-ivory py-[clamp(3.5rem,6vw,5.5rem)]" id="alur">
      <Container>
        <SectionKicker>03 / Alur kerja</SectionKicker>
        <div className="mb-8 flex flex-col gap-5 lg:mb-12 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <h2 className="font-display text-[clamp(2.45rem,4.5vw,4.05rem)] font-semibold leading-[1.02] text-green-950">Mulai sederhana.<br /><em className="not-italic text-green-700">Tumbuh dengan tenang.</em></h2>
          <p className="mb-1 max-w-[23.125rem] text-sm leading-[1.65] text-muted">Rakku tidak memaksa Anda mengubah cara kerja dalam semalam. Mulai dari alur yang paling penting, lalu tambahkan detail saat bisnis siap.</p>
        </div>
        <Stagger className="grid border-t border-brand sm:grid-cols-2 lg:grid-cols-4 lg:border-t-0">
          {steps.map((step, index) => (
            <StaggerItem key={step.number} className={`min-h-[17.5rem] border-b border-brand py-6 lg:border-b-0 lg:border-r lg:px-6 lg:py-6 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0 ${index % 2 === 1 ? "sm:pl-5" : "sm:pr-5"}`}>
              <div id={index === 0 ? "cara-kerja" : undefined}>
                <span className="mb-5 block font-mono text-[0.65rem] text-coral">{step.number}</span>
                {step.visual}
                <h3 className="mb-2 font-display text-[1.45rem] font-semibold leading-[1.1] text-green-950">{step.title}</h3>
                <p className="m-0 max-w-[13.75rem] text-[0.8125rem] leading-[1.55] text-muted">{step.description}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </ScrollReveal>
  );
}

function RecipeBoard() {
  const ingredients = [
    ["bean", "Espresso Beans", "5.000 gram tersedia", "18 gram"],
    ["milk", "Susu UHT", "20.000 ml tersedia", "150 ml"],
    ["cup", "Cup 16oz", "380 pcs tersedia", "1 pcs"],
  ];

  return (
    <div className="recipe-board" aria-label="Contoh konfigurasi resep produk dan stok bahan baku">
      <div className="flex items-center justify-between gap-3 border-b border-[#e1e6da] px-4 py-3 font-mono text-[0.5rem] tracking-[0.06em] text-[#849188] sm:px-5">
        <span>PRODUCT / EDIT</span><b className="ml-auto font-medium tracking-normal text-green-800">products / edit</b><span className="rounded bg-[#e5f0dd] px-1.5 py-1 text-green-700">Aktif</span>
      </div>
      <div className="flex items-center gap-2 border-b border-[#e5e9e2] bg-white px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eef2eb] text-sm text-[#617267]" aria-hidden="true">←</span>
        <div className="min-w-0 flex-1"><span className="block font-mono text-[0.42rem] uppercase tracking-[0.08em] text-[#809087]">Edit Produk</span><h3 className="my-1 truncate font-sans text-sm font-semibold tracking-[-0.035em] text-green-900 sm:text-base">Kopi Susu Gula Aren</h3><p className="truncate text-[0.43rem] text-[#8a948e] sm:text-[0.5rem]">Konfigurasi untuk sistem inventory dan POS</p></div>
        <span className="shrink-0 rounded bg-[#2e7d32] px-2 py-1.5 font-mono text-[0.42rem] text-white">Simpan</span>
      </div>
      <div className="recipe-editor-grid">
        <div className="product-info-panel">
          <div className="product-placeholder" aria-hidden="true"><span className="placeholder-cup" /><span className="placeholder-shine" /></div>
          <div className="field-preview"><span>Status Produk</span><b className="field-active">Aktif</b></div>
          <div className="field-preview"><span>Nama Produk</span><strong>Kopi Susu Gula Aren</strong></div>
          <div className="field-preview"><span>Kategori</span><strong>Coffee</strong></div>
        </div>
        <div className="recipe-panel">
          <div className="mb-2.5 flex items-start justify-between gap-2.5"><div><strong className="block text-xs text-green-900">Resep / Bahan Baku</strong><small className="mt-1 block text-[0.43rem] text-[#89948b]">Bahan terpakai per 1 porsi produk ini</small></div><span className="whitespace-nowrap font-mono text-[0.4rem] font-bold text-[#2e7d32]">Kelola Resep</span></div>
          <div className="recipe-rows">
            {ingredients.map(([tone, name, stock, amount]) => (
              <div key={name} className="recipe-row"><div><i className={`ingredient-dot ${tone}`} /><span><strong>{name}</strong><small>{stock}</small></span></div><b>{amount}</b><em>Aktif</em></div>
            ))}
          </div>
          <div className="stock-sync"><span className="sync-dot" /><div><strong>Stok mengikuti penjualan</strong><small>Otomatis berkurang setelah order selesai</small></div><b>HPP Rp 8.450</b></div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[#e1e6da] px-3 py-2.5 font-mono text-[0.4rem] text-[#849188] sm:px-5"><span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#69a85a]" /> Resep tersimpan untuk 1 porsi</span><span className="text-sm text-green-700">↗</span></div>
    </div>
  );
}

function InventoryStory() {
  return (
    <ScrollReveal className="bg-green-800 py-[clamp(3.5rem,6vw,5.5rem)] text-ivory" id="inventory">
      <Stagger className="landing-container grid items-center gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-[clamp(2.5rem,6vw,4.5rem)]">
        <StaggerItem>
          <SectionKicker light>04 / Dari resep ke stok</SectionKicker>
          <h2 className="font-display text-[clamp(2.45rem,4.5vw,4.05rem)] font-semibold leading-[1.02] text-ivory">Satu gelas kopi.<br /><em className="not-italic text-lime">Jejaknya jelas.</em></h2>
          <p className="mt-5 max-w-[24.375rem] text-[0.9375rem] leading-[1.65] text-ivory/70">Rakku menggunakan resep yang sama untuk menghitung pemakaian bahan, HPP, dan peringatan stok. Tidak ada mekanisme terpisah untuk produk jadi atau resale.</p>
          <TextLink href="#fitur" light>Lihat fitur inventory <ArrowRightIcon className="h-4 w-4" /></TextLink>
        </StaggerItem>
        <StaggerItem>
          <Lift>
            <RecipeBoard />
          </Lift>
        </StaggerItem>
      </Stagger>
    </ScrollReveal>
  );
}

function Audience() {
  const ownerItems = ["Outlet & karyawan", "HPP & laba rugi", "QR menu per outlet"];
  const cashierItems = ["Register cepat", "Draft & split bill", "PWA untuk operasional"];

  return (
    <ScrollReveal className="bg-paper py-[clamp(3.5rem,6vw,5.5rem)]" id="untuk-siapa">
      <Container>
        <div className="mb-8 flex flex-col gap-6 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
          <div><SectionKicker>05 / Dua layar, satu ritme</SectionKicker><h2 className="font-display text-[clamp(2.45rem,4.5vw,4.05rem)] font-semibold leading-[1.02] text-green-950">Owner berpikir jauh.<br /><em className="not-italic text-green-700">Kasir bergerak cepat.</em></h2></div>
          <p className="m-0 max-w-[18.75rem] text-sm leading-[1.65] text-muted">Permukaan kerja yang berbeda untuk kebutuhan yang berbeda, tetap terhubung lewat data outlet yang sama.</p>
        </div>
        <Stagger className="grid gap-3 md:grid-cols-2">
          <StaggerItem>
            <AudienceCard label="Portal Owner" title={<>Untuk keputusan<br />di balik layar.</>} description="Kelola outlet, tim, katalog, harga, resep, pengeluaran, dan laporan laba dari satu dashboard." items={ownerItems} owner />
          </StaggerItem>
          <StaggerItem>
            <AudienceCard label="POS Kasir" title={<>Untuk transaksi<br />di garis depan.</>} description="Login 4 langkah, pilih produk, atur modifier, kelola meja, terima pembayaran, dan cetak invoice." items={cashierItems} />
          </StaggerItem>
        </Stagger>
      </Container>
    </ScrollReveal>
  );
}

function AudienceCard({ label, title, description, items, owner = false }: { label: string; title: React.ReactNode; description: string; items: string[]; owner?: boolean }) {
  return (
    <Lift className={`audience-card relative flex h-full min-h-[22rem] flex-col overflow-hidden rounded-lg p-6 ${owner ? "bg-green-950 text-ivory" : "bg-lime text-green-950"}`}>
      <div className="relative z-10 flex items-center justify-between"><span className="font-mono text-[0.65rem] uppercase tracking-[0.1em]">{label}</span><ArrowUpRightIcon className="h-5 w-5" /></div>
      <h3 className="relative z-10 mt-12 font-display text-[clamp(2.2rem,4.3vw,2.7rem)] font-semibold leading-[0.98]">{title}</h3>
      <p className={`relative z-10 mt-3 max-w-[20rem] text-sm leading-[1.6] ${owner ? "text-ivory/65" : "text-green-950/70"}`}>{description}</p>
      <div className="relative z-10 mt-4 flex flex-wrap gap-2">{items.map((item) => <span key={item} className={`rounded border px-2 py-1.5 font-mono text-[0.5rem] ${owner ? "border-ivory/20 text-ivory/75" : "border-green-950/20 text-green-950/75"}`}>{item}</span>)}</div>
      {owner ? <div className="absolute -bottom-10 right-[-1.5rem] h-40 w-[70%] rotate-[-5deg] rounded-t-lg border-[7px] border-ivory/20 bg-[#f7f9f2] p-4" aria-hidden="true"><div className="h-2.5 w-3/5 rounded-sm bg-[#d2e6c7]" /><div className="my-2 h-2.5 w-2/5 rounded-sm bg-[#e8efe3]" /><div className="h-2.5 w-4/5 rounded-sm bg-[#edf3e9]" /><span className="absolute right-5 top-8 h-11 w-11 rounded-full border-[8px] border-[#b9d99a]" /></div> : <div className="absolute -bottom-10 right-[-1.5rem] h-40 w-[70%] rotate-[5deg] rounded-t-lg border-[7px] border-green-950/15 bg-[#fff9e6] p-4" aria-hidden="true"><div className="grid grid-cols-2 gap-2"><i className="h-10 rounded bg-[#e9d69a]" /><i className="h-10 rounded bg-[#d5e5ae]" /><i className="h-10 rounded bg-[#e5c99e]" /><i className="h-10 rounded bg-[#cfe1a7]" /></div><div className="absolute bottom-5 right-6 h-14 w-20 rounded border border-green-950/15 bg-ivory" /></div>}
    </Lift>
  );
}

function FAQ() {
  const questions = [
    ["Apakah Rakku hanya untuk cafe?", "Rakku paling cocok untuk kedai kopi, cafe, dan bisnis F&B kecil yang memiliki produk, transaksi, bahan baku, dan satu atau beberapa outlet."],
    ["Apakah stok langsung berkurang saat transaksi?", "Ya. Setelah order berstatus selesai, stok bahan akan berkurang mengikuti resep produk dan tercatat di stock movement."],
    ["Apakah stok yang kurang akan memblokir transaksi?", "Tidak. Stok boleh minus agar operasional tidak berhenti. Rakku memberi peringatan supaya tim bisa melakukan pengecekan atau restock."],
    ["Apakah menu QR bisa menerima pesanan langsung?", "Belum. Menu QR pada fase ini bersifat view-only. Pelanggan dapat melihat katalog dan harga tanpa login atau memasang aplikasi."],
    ["Siapa yang bisa melihat laporan laba?", "Laporan HPP dan laba rugi ditujukan untuk Owner. Akses menu dapat diatur sesuai role perusahaan."],
  ];

  return (
    <ScrollReveal className="bg-paper-deep py-[clamp(3.5rem,6vw,5.5rem)]" id="faq">
      <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-[5.5rem]">
        <div><SectionKicker>06 / Pertanyaan umum</SectionKicker><h2 className="font-display text-[clamp(2.45rem,4.5vw,4.05rem)] font-semibold leading-[1.02] text-green-950">Yang perlu diketahui<br /><em className="not-italic text-green-700">sebelum mulai.</em></h2><p className="mt-5 max-w-[17.5rem] text-sm leading-[1.65] text-muted">Rakku dibuat untuk kedai dan cafe kecil yang ingin bekerja lebih teratur tanpa menambah kerumitan.</p></div>
        <Stagger className="border-t border-brand">
          {questions.map(([question, answer], index) => <StaggerItem key={question}><details open={index === 0} className="group border-b border-brand"><summary className="flex min-h-[4rem] cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-[clamp(1.15rem,2vw,1.3rem)] tracking-[-0.025em] text-green-950 transition-colors duration-200 marker:hidden group-hover:text-green-700 [&::-webkit-details-marker]:hidden"><span>{question}</span><span className="text-2xl font-normal text-coral transition-transform duration-200 group-open:rotate-45" aria-hidden="true">+</span></summary><p className="faq-answer mb-4 mr-8 max-w-[39.375rem] text-sm leading-[1.65] text-muted">{answer}</p></details></StaggerItem>)}
        </Stagger>
      </Container>
    </ScrollReveal>
  );
}

function FinalCta() {
  return (
    <ScrollReveal className="bg-paper py-[clamp(3.5rem,6vw,5.5rem)]">
      <Container>
        <div className="relative flex min-h-[20rem] flex-col justify-between gap-8 overflow-hidden rounded-lg bg-green-950 px-6 py-8 text-ivory sm:px-12 lg:flex-row lg:items-center lg:gap-14 lg:px-[4.7rem]">
          <div className="cta-orbit pointer-events-none absolute -bottom-40 -right-24 h-[27.5rem] w-[27.5rem] rounded-full border border-lime/25 shadow-[0_0_0_35px_rgba(211,230,109,0.06),0_0_0_70px_rgba(211,230,109,0.04)]" />
          <div className="absolute right-7 top-6 grid h-12 w-12 rotate-12 place-items-center rounded-full border border-lime/50 font-display text-3xl text-lime" aria-hidden="true">R</div>
          <div className="relative z-10"><SectionKicker light>Mulai dari sini</SectionKicker><h2 className="font-display text-[clamp(2.9rem,5vw,4.5rem)] font-semibold leading-[0.95] text-ivory">Rapi dulu.<br /><em className="not-italic text-lime">Tumbuh kemudian.</em></h2><p className="mt-4 max-w-[22.5rem] text-sm text-ivory/65">Bangun fondasi operasional yang bisa mengikuti cara bisnis Anda berkembang.</p></div>
          <div className="relative z-10 flex min-w-[11.875rem] flex-col gap-2.5"><ButtonLink href={`${ownerUrl}/register`} className="min-h-[3.375rem] bg-lime text-green-950 hover:bg-[#e0ee94]">Mulai gratis <ArrowRightIcon className="h-4 w-4" /></ButtonLink><ButtonLink href={`${posUrl}/login`} className="min-h-[3.375rem] border border-ivory/30 text-ivory hover:border-lime hover:text-lime">Buka POS Kasir</ButtonLink></div>
        </div>
      </Container>
    </ScrollReveal>
  );
}

function Footer() {
  return (
    <footer className="bg-green-950 pb-[env(safe-area-inset-bottom)] text-ivory/70">
      <Container className="flex flex-col justify-between gap-10 py-10 lg:flex-row lg:gap-20">
        <div><a href="#top" className="flex items-center gap-2.5 text-ivory" aria-label="Rakku, kembali ke atas"><Image src="/images/rakku_logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" /><span className="font-display text-[1.7rem]">rakku</span></a><p className="mt-4 max-w-[11.25rem] text-xs text-ivory/50">Sistem operasional untuk kedai kecil &amp; cafe.</p></div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-16">
          <FooterGroup label="Produk" links={[["Fitur", "#fitur"], ["Cara kerja", "#alur"], ["FAQ", "#faq"]]} />
          <FooterGroup label="Akses" links={[["Portal Owner", `${ownerUrl}/login`], ["POS Kasir", `${posUrl}/login`]]} />
          <FooterGroup label="Dokumen" links={[["Bantuan", "#faq"], ["Privasi", "#faq"]]} />
        </div>
      </Container>
      <Container className="flex flex-col gap-3 border-t border-ivory/15 py-4 font-mono text-[0.5rem] text-ivory/40 sm:flex-row sm:justify-between sm:py-5"><span>© 2026 Rakku. Dibuat untuk bisnis yang sedang bertumbuh.</span><span className="text-lime">operasional / tersusun rapi</span></Container>
    </footer>
  );
}

function FooterGroup({ label, links }: { label: string; links: string[][] }) {
  return <div className="flex min-w-[5.6rem] flex-col items-start gap-2"><span className="mb-2 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-lime">{label}</span>{links.map(([text, href]) => <a key={text} href={href} className="landing-link-underline text-xs transition-colors duration-200 hover:text-lime">{text}</a>)}</div>;
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-[150%] rounded-md bg-green-950 px-4 py-2.5 text-sm text-ivory transition-transform focus:translate-y-0">Lewati ke konten utama</a>
      <Header />
      <main id="main-content">
        <Hero />
        <SignalStrip />
        <Problem />
        <Features />
        <Workflow />
        <InventoryStory />
        <Audience />
        <FAQ />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
