import type { Metadata } from "next";
import "./globals.css";
import SessionGuard from "@/components/layout/SessionGuard";

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
      <body><SessionGuard />{children}</body>
    </html>
  );
}
