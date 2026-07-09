"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Store, User, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { showToast, ToastContainer } from "@rakku/ui";

export default function OwnerSignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      showToast("error", "Semua field harus diisi");
      return;
    }
    if (password.length < 8) {
      showToast("error", "Password minimal 8 karakter");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/owner/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Pendaftaran gagal");
        setIsLoading(false);
        return;
      }
      showToast("success", "Akun berhasil dibuat!");
      router.push("/check-email");
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f8f9ff]">
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 py-8 sm:px-12">
        <div className="w-full max-w-sm mx-auto">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-forest rounded-xl flex items-center justify-center text-white">
              <Store size={22} />
            </div>
            <span className="text-2xl font-extrabold text-forest tracking-tight">
              Rakku
            </span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-neutral-900">
              Mulai Bisnis Anda
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              Kelola transaksi dan laporan dalam satu tempat.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                htmlFor="name"
              >
                Nama Lengkap
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="w-full h-12 pl-11 pr-4 bg-neutral-50 border border-neutral-200 rounded-xl text-base text-neutral-900 placeholder-neutral-400 outline-none focus:border-forest focus:bg-white focus:ring-2 focus:ring-forest/10 transition-all"
                />
              </div>
            </div>

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
                  placeholder="john@bisnis.id"
                  required
                  className="w-full h-12 pl-11 pr-4 bg-neutral-50 border border-neutral-200 rounded-xl text-base text-neutral-900 placeholder-neutral-400 outline-none focus:border-forest focus:bg-white focus:ring-2 focus:ring-forest/10 transition-all"
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
                  className="w-full h-12 pl-11 pr-11 bg-neutral-50 border border-neutral-200 rounded-xl text-base text-neutral-900 placeholder-neutral-400 outline-none focus:border-forest focus:bg-white focus:ring-2 focus:ring-forest/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-forest transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-neutral-400">Minimal 8 karakter</p>
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
                  Daftar Sekarang
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-neutral-400 mt-6">
            Sudah punya akun?{" "}
            <Link
              href="/login"
              className="font-bold text-forest hover:underline"
            >
              Masuk
            </Link>
          </p>

          <p className="text-center text-[11px] text-neutral-300 mt-4 max-w-[260px] mx-auto leading-relaxed">
            Dengan mendaftar, Anda menyetujui Ketentuan Layanan dan Kebijakan
            Privasi Rakku.
          </p>
        </div>
      </div>

      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <Image
          src="/images/signup.jpg"
          alt="Signup"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 z-10">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-white">
            Transformasi Bisnis Anda Menjadi Lebih Cerdas.
          </h2>
          <div className="flex gap-6 mt-8">
            <div>
              <span className="text-2xl font-bold block text-white">24/7</span>
              <span className="text-sm text-white/80">Akses Kapan saja</span>
            </div>
            <div className="w-px h-10 bg-white/30 self-center"></div>
            <div>
              <span className="text-2xl font-bold block text-white">100%</span>
              <span className="text-sm text-white/80">Real-time Data</span>
            </div>
            <div className="w-px h-10 bg-white/30 self-center"></div>
            <div>
              <span className="text-2xl font-bold block text-white">Gratis</span>
              <span className="text-sm text-white/80">Mulai Sekarang</span>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}
