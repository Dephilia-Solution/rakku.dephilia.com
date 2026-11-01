import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";
import SessionGuard from "@/components/layout/SessionGuard";

const inter = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rakku Owner",
  description: "Dashboard Owner untuk Rakku POS",
};

export const viewport: Viewport = {
  themeColor: "#2E7D32",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <SessionGuard />
        <script
          dangerouslySetInnerHTML={{
            __html: `if(!location.pathname.startsWith("/demo")){try{var s=window.localStorage.getItem("rakku-owner-sidebar-collapsed");document.documentElement.setAttribute("data-owner-sidebar",s==="1"?"collapsed":"expanded")}catch(e){}}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
