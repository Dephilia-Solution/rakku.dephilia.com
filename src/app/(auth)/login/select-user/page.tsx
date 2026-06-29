"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Coffee, User, ChevronRight, LogOut } from "lucide-react";

interface Account {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  role_name: string;
}

export default function SelectUserPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [outletName, setOutletName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/tenant/accounts")
      .then((res) => {
        if (!res.ok) throw new Error("unauthorized");
        return res.json();
      })
      .then((data) => {
        setAccounts(data.accounts);
        setOutletName(data.outlet_name || "");
        setIsLoading(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  const handleSelect = (userId: string) => {
    setSubmitting(userId);
    router.push(`/login/enter-pin?user_id=${userId}`);
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
          <div className="w-14 h-14 bg-forest rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Coffee size={28} className="text-white" />
          </div>
          <h1 className="font-display font-bold text-2xl text-neutral-900">
            Pilih Akun
          </h1>
          <p className="text-sm text-neutral-400 mt-1">{outletName}</p>
        </div>

        <div className="space-y-2">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => handleSelect(account.id)}
              disabled={submitting === account.id}
              className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-neutral-50 active:scale-[0.98] transition-all text-left disabled:opacity-70"
            >
              <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center shrink-0">
                {account.avatar_url ? (
                  <Image
                    src={account.avatar_url}
                    alt=""
                    width={40}
                    height={40}
                    className="rounded-xl object-cover"
                  />
                ) : (
                  <User size={20} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-neutral-900">
                  {account.name}
                </p>
                <p className="text-xs text-neutral-400">{account.role_name}</p>
              </div>
              {submitting === account.id ? (
                <div className="w-5 h-5 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
              ) : (
                <ChevronRight size={18} className="text-neutral-300" />
              )}
            </button>
          ))}
        </div>

        {accounts.length === 0 && !isLoading && (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <User size={32} className="mx-auto text-neutral-300 mb-2" />
            <p className="text-sm text-neutral-400">
              Tidak ada akun yang tersedia untuk outlet ini
            </p>
          </div>
        )}

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
