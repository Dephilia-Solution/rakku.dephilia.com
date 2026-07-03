"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Store, ChevronRight, LogOut } from "lucide-react";
import { showToast } from "@/components/shared/Toast";

interface Outlet {
  id: string;
  name: string;
  address: string | null;
}

export default function SelectOutletPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/tenant/outlet")
      .then((res) => {
        if (!res.ok) throw new Error("unauthorized");
        return res.json();
      })
      .then((data) => {
        setOutlets(data.outlets);
        setCompanyName(data.company_name || "");
        setIsLoading(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  const handleSelect = async (outletId: string) => {
    setSubmitting(outletId);
    const res = await fetch("/api/auth/tenant/outlet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outlet_id: outletId }),
    });

    if (!res.ok) {
      const data = await res.json();
      showToast("error", data.error || "Gagal memilih outlet");
      setSubmitting(null);
      return;
    }

    router.push("/login/select-user");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-forest rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm overflow-hidden">
            <Image src="/images/rakku_logo.png" alt="Rakku" width={56} height={56} className="w-full h-full object-cover" />
          </div>
          <h1 className="font-display font-bold text-2xl text-neutral-900">
            Pilih Outlet
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            {companyName || "Perusahaan Anda"}
          </p>
        </div>

        <div className="space-y-2">
          {outlets.map((outlet) => (
            <button
              key={outlet.id}
              onClick={() => handleSelect(outlet.id)}
              disabled={submitting === outlet.id}
              className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-neutral-50 active:scale-[0.98] transition-all text-left disabled:opacity-70"
            >
              <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center shrink-0">
                <Store size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-neutral-900">
                  {outlet.name}
                </p>
                {outlet.address && (
                  <p className="text-xs text-neutral-400 truncate">
                    {outlet.address}
                  </p>
                )}
              </div>
              {submitting === outlet.id ? (
                <div className="w-5 h-5 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
              ) : (
                <ChevronRight size={18} className="text-neutral-300" />
              )}
            </button>
          ))}
        </div>

        <form action="/api/auth/tenant/logout" method="post" className="mt-6">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 text-sm text-neutral-400 hover:text-danger py-2 transition-colors"
          >
            <LogOut size={16} />
            Batalkan & kembali
          </button>
        </form>
      </div>
    </div>
  );
}
