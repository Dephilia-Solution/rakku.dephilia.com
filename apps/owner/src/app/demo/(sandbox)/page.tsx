import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";

export default function DemoEntry({ searchParams }: { searchParams: { mode?: string } }) {
  if (searchParams.mode === "pos") redirect("/demo/pos/login/select-outlet");
  return <AuthShell>
    <h2 className="mb-2 text-2xl font-bold text-ink">Coba Rakku</h2>
    <p className="mb-6 text-sm text-muted">Pilih dashboard Owner atau kasir.</p>
    <div className="space-y-3">
      <Link href="/demo/owner/dashboard" prefetch={false} className="flex min-h-12 items-center justify-center rounded-xl bg-leaf px-6 py-3 text-sm font-semibold text-white hover:bg-leaf-dark">Demo Owner</Link>
      <Link href="/demo/pos/login/select-outlet" prefetch={false} className="flex min-h-12 items-center justify-center rounded-xl border border-line px-6 py-3 text-sm font-semibold text-leaf hover:bg-cream">Demo Kasir</Link>
    </div>
  </AuthShell>;
}
