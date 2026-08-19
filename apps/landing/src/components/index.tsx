import { Audience } from "./audience";
import { FAQ } from "./faq";
import { Features } from "./features";
import { FinalCta } from "./final-cta";
import { Footer } from "./footer";
import { Header } from "./header";
import { Hero } from "./hero";
import { InventoryStory } from "./inventory-story";
import { Problem } from "./problem";
import { SignalStrip } from "./signal-strip";
import { Workflow } from "./workflow";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-[150%] rounded-md bg-green-950 px-4 py-2.5 text-sm text-ivory transition-transform focus:translate-y-0">
        Lewati ke konten utama
      </a>
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
