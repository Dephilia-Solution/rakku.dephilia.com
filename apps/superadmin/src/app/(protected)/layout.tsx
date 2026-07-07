import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@rakku/supabase-clients/server";
import Link from "next/link";
import {
  Building2,
  Store,
  Menu,
  Users,
  ShieldCheck,
  LogOut,
  Settings,
  FileText,
} from "lucide-react";
import { ToastContainer } from "@rakku/ui";

const superadminNav = [
  { href: "/companies", icon: Building2, label: "Companies" },
  { href: "/outlets", icon: Store, label: "Outlets" },
  { href: "/menus", icon: Menu, label: "Menus" },
  { href: "/roles", icon: Users, label: "Roles" },
  { href: "/access-matrix", icon: ShieldCheck, label: "Access" },
  { href: "/users", icon: Settings, label: "Users" },
  { href: "/audit-logs", icon: FileText, label: "Audit Logs" },
];

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 h-screen fixed left-0 top-0 bg-white border-r border-neutral-200 flex flex-col py-4 z-40">
        <div className="px-4 mb-6">
          <Link
            href="/companies"
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-forest overflow-hidden flex-shrink-0">
              <Image src="/images/rakku_logo.png" alt="Rakku" width={32} height={32} className="w-full h-full object-cover" />
            </div>
            <span className="font-display font-bold text-sm text-neutral-900">
              Rakku Admin
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {superadminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
            >
              <item.icon size={18} className="text-neutral-400" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-2 mt-auto">
          <Link
            href={process.env.NEXT_PUBLIC_OWNER_URL || "http://localhost:3000"}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-neutral-400 hover:text-neutral-600 transition-colors mb-1"
          >
            <Store size={18} />
            Ke POS
          </Link>
          <form action="/api/superadmin/auth/logout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-neutral-400 hover:text-danger hover:bg-red-50 transition-colors"
            >
              <LogOut size={18} />
              Logout
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 ml-56">
        <div className="p-6">{children}</div>
      </main>
      <ToastContainer />
    </div>
  );
}
