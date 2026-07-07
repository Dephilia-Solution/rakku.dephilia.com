import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rakku Superadmin",
  description: "Panel Superadmin untuk Rakku POS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
