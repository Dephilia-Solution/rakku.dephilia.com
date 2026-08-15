"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { showToast, ToastContainer } from "@rakku/ui";
import AuthShell from "@/components/auth/AuthShell";

export default function OwnerSignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
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
    if (!agreed) {
      showToast("error", "Anda harus menyetujui Syarat Layanan dan Kebijakan Privasi");
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
    <>
      <AuthShell reverse>
        <h2 className="font-serif font-medium text-[25px] tracking-[-0.01em] m-0 mb-1.5 text-ink">
          Buat akun baru
        </h2>
        <p className="text-[13.5px] text-muted m-0 mb-[26px] leading-[1.5]">
          Mulai kelola bisnis Anda dengan Rakku hari ini.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field flex flex-col gap-1.5 mb-[15px]">
            <label
              htmlFor="name"
              className="text-[11px] font-semibold tracking-[0.04em] uppercase text-muted"
            >
              Nama usaha
            </label>
            <div className="auth-inputwrap relative flex items-center">
              <svg
                className="auth-icon absolute left-[13px] w-4 h-4 text-[#9AA39C] pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3 9.5 12 3l9 6.5V21H3V9.5Z" />
                <path d="M9 21v-7h6v7" />
              </svg>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama usaha"
                autoComplete="organization"
                required
                className="w-full py-[11px] px-[13px] pl-[38px] border-[1.5px] border-line rounded-[10px] font-sans text-[13.5px] text-ink bg-white transition-[border-color,box-shadow] duration-200 outline-none placeholder:text-[#A8B0A5] focus:border-leaf focus:shadow-[0_0_0_4px_rgba(46,125,50,0.1)]"
              />
            </div>
          </div>

          <div className="auth-field flex flex-col gap-1.5 mb-[15px]">
            <label
              htmlFor="email"
              className="text-[11px] font-semibold tracking-[0.04em] uppercase text-muted"
            >
              Email
            </label>
            <div className="auth-inputwrap relative flex items-center">
              <svg
                className="auth-icon absolute left-[13px] w-4 h-4 text-[#9AA39C] pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                required
                className="w-full py-[11px] px-[13px] pl-[38px] border-[1.5px] border-line rounded-[10px] font-sans text-[13.5px] text-ink bg-white transition-[border-color,box-shadow] duration-200 outline-none placeholder:text-[#A8B0A5] focus:border-leaf focus:shadow-[0_0_0_4px_rgba(46,125,50,0.1)]"
              />
            </div>
          </div>

          <div className="auth-field flex flex-col gap-1.5 mb-[15px]">
            <label
              htmlFor="password"
              className="text-[11px] font-semibold tracking-[0.04em] uppercase text-muted"
            >
              Kata sandi
            </label>
            <div className="auth-inputwrap relative flex items-center">
              <svg
                className="auth-icon absolute left-[13px] w-4 h-4 text-[#9AA39C] pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata sandi"
                autoComplete="new-password"
                required
                className="w-full py-[11px] px-[13px] pl-[38px] pr-[40px] border-[1.5px] border-line rounded-[10px] font-sans text-[13.5px] text-ink bg-white transition-[border-color,box-shadow] duration-200 outline-none placeholder:text-[#A8B0A5] focus:border-leaf focus:shadow-[0_0_0_4px_rgba(46,125,50,0.1)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                className="auth-eye absolute right-3 bg-transparent border-0 cursor-pointer text-[#9AA39C] flex p-0 hover:text-muted transition-colors"
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.06 21.06 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a21.06 21.06 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <path d="M1 1l22 22" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <label className="auth-terms flex items-start gap-2 text-[12.5px] text-muted leading-[1.5] mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-[3px] w-[14px] h-[14px] accent-leaf flex-shrink-0 cursor-pointer"
            />
            <span>
              Saya menyetujui{" "}
              <Link href="#" className="text-leaf font-semibold no-underline hover:underline">
                Syarat Layanan
              </Link>{" "}
              dan{" "}
              <Link href="#" className="text-leaf font-semibold no-underline hover:underline">
                Kebijakan Privasi
              </Link>{" "}
              Rakku.
            </span>
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="auth-btn w-full py-[13px] border-0 rounded-[10px] bg-leaf text-white font-sans text-[13.5px] font-semibold cursor-pointer flex items-center justify-center gap-2 transition-[background,transform] duration-200 hover:bg-leaf-dark active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Buat akun
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-5 text-[13px] text-muted">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-leaf font-semibold no-underline hover:underline">
            Masuk di sini
          </Link>
        </p>
      </AuthShell>
      <ToastContainer />
    </>
  );
}
