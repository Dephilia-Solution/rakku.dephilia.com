"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Lock, Eye, EyeOff, Building2 } from "lucide-react";
import { showToast } from "@/components/shared/Toast";
import ToastContainer from "@/components/shared/Toast";

export default function CompanyLoginPage() {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !password) {
      showToast("error", "Kode perusahaan dan password harus diisi");
      return;
    }
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/tenant/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast("error", data.error || "Login gagal");
        setIsLoading(false);
        return;
      }

      router.push("/login/select-outlet");
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-forest rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Coffee size={28} className="text-white" />
          </div>
          <h1 className="font-display font-bold text-2xl text-neutral-900">
            Stocko
          </h1>
          <p className="text-sm text-neutral-400 mt-1">Masuk ke perusahaan Anda</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
              Kode Perusahaan
            </label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="KOPIKITA"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest uppercase"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
              Password Perusahaan
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-forest text-white rounded-xl px-6 py-3 font-semibold text-sm hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Lock size={16} />
                Masuk
              </>
            )}
          </button>
        </form>
      </div>
      <ToastContainer />
    </div>
  );
}
