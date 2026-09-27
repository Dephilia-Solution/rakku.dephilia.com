import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { MotionProvider } from "@/components/motion";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Rakku | Kasir, stok, dan laba dalam satu alur",
    template: "%s | Rakku",
  },
  description:
    "Rakku membantu kedai dan cafe mengelola kasir, stok bahan baku, resep, outlet, dan laba dalam satu sistem.",
  keywords: ["POS cafe", "inventory F&B", "kasir kedai", "Rakku"],
  openGraph: {
    title: "Rakku | Kasir, stok, dan laba dalam satu alur",
    description: "Satu alur kerja untuk kasir, stok, resep, outlet, dan laba.",
    type: "website",
    locale: "id_ID",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d5b38",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${dmSans.variable} ${jetBrainsMono.variable}`}>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
