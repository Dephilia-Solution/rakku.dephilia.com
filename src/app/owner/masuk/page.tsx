"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Store, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { showToast } from "@/components/shared/Toast";
import ToastContainer from "@/components/shared/Toast";

export default function OwnerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast("error", "Email dan password harus diisi");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.need_verify) {
          showToast("info", "Email belum diverifikasi. Mengarahkan ke halaman verifikasi...");
          setIsLoading(false);
          router.push("/owner/cek-email");
          return;
        }
        showToast("error", data.error || "Login gagal");
        setIsLoading(false);
        return;
      }
      showToast("success", `Selamat datang, ${data.owner.name}!`);
      router.push(data.redirect || "/owner");
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f8f9ff]">
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-forest via-forest-dark to-neutral-900 items-center justify-center p-12">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-forest-light/20 rounded-full blur-3xl"></div>
        <div className="relative z-10 max-w-md text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Store size={24} />
            </div>
            <h1 className="text-3xl font-extrabold">Rakku</h1>
          </div>
          <p className="text-base text-white/90 leading-relaxed">
            Kelola bisnis kuliner Anda dengan lebih efisien melalui sistem
            manajemen terpadu yang modern dan mudah digunakan.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 py-8 sm:px-12">
        <div className="w-full max-w-sm mx-auto">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-forest rounded-xl flex items-center justify-center text-white">
              <Store size={22} />
            </div>
            <span className="text-2xl font-extrabold text-forest">Rakku</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-neutral-900">
              Selamat Datang Kembali
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Masuk ke akun owner Anda untuk melanjutkan.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                htmlFor="email"
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="merchant@example.com"
                  required
                  className="w-full h-12 pl-11 pr-4 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-forest focus:bg-white focus:ring-2 focus:ring-forest/10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-12 pl-11 pr-11 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-forest focus:bg-white focus:ring-2 focus:ring-forest/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-forest transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-forest text-white font-semibold text-sm rounded-xl shadow-md shadow-forest/20 hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Masuk Sekarang
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-neutral-400 mt-6">
            Belum punya akun?{" "}
            <Link
              href="/owner/daftar"
              className="font-bold text-forest hover:underline"
            >
              Daftar Sekarang
            </Link>
          </p>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}
