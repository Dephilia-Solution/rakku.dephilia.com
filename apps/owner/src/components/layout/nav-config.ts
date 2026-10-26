import {
  LayoutDashboard,
  BarChart3,
  ClipboardList,
  Building2,
  Settings,
  CreditCard,
  Wallet,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";

export interface OwnerNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
}

/** Semua menu utama owner app (urutan = urutan tampil di sidebar). */
export const ownerMenuItems: OwnerNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/orders", label: "Pesanan", icon: ClipboardList },
  { href: "/outlets", label: "Outlet", icon: Building2 },
  { href: "/subscription", label: "Langganan", icon: CreditCard },
  { href: "/balance", label: "Saldo", icon: Wallet },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

const posUrl = process.env.NEXT_PUBLIC_POS_URL || "http://localhost:3001";

export const loginKasirItem: OwnerNavItem = {
  href: posUrl,
  label: "Login Kasir",
  icon: ExternalLink,
  external: true,
};

/** 4 menu utama di bottom nav mobile, sisanya masuk sheet "Lainnya". */
export const ownerPrimaryItems: OwnerNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/orders", label: "Pesanan", icon: ClipboardList },
  { href: "/outlets", label: "Outlet", icon: Building2 },
];

export const ownerOverflowItems: OwnerNavItem[] = [
  { href: "/subscription", label: "Langganan", icon: CreditCard },
  { href: "/balance", label: "Saldo", icon: Wallet },
  { href: "/settings", label: "Pengaturan", icon: Settings },
  loginKasirItem,
];
