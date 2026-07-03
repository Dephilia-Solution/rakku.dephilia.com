import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rakku POS",
  description: "Point of Sale system for F&B businesses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
