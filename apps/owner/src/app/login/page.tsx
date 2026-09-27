"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { showToast, ToastContainer } from "@rakku/ui";
import AuthShell from "@/components/auth/AuthShell";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "Token tidak valid atau sudah kadaluarsa. Coba minta link verifikasi baru.",
  verify_failed: "Verifikasi email gagal. Coba lagi atau hubungi dukungan.",
};

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  useEffect(() => {
    if (errorParam && ERROR_MESSAGES[errorParam]) {
      showToast("error", ERROR_MESSAGES[errorParam]);
    }
  }, [errorParam]);

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
        body: JSON.stringify({ email, password, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.need_verify) {
          showToast("info", "Email belum diverifikasi. Mengarahkan ke halaman verifikasi...");
          setIsLoading(false);
          router.push("/check-email");
          return;
        }
        showToast("error", data.error || "Login gagal");
        setIsLoading(false);
        return;
      }
      showToast("success", `Selamat datang, ${data.owner.name}!`);
      router.push(data.redirect === "/onboarding" ? "/onboarding" : "/dashboard");
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthShell>
        <h2 className="m-0 mb-1 font-serif text-[22px] font-medium tracking-[-0.01em] text-ink sm:text-[25px]">
          Selamat datang kembali
        </h2>
        <p className="m-0 mb-4 text-[13px] leading-[1.45] text-muted sm:mb-5 sm:text-[13.5px]">
          Masuk ke akun owner Anda untuk melanjutkan.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field mb-2.5 flex flex-col gap-1 sm:mb-3">
            <label
              htmlFor="email"
              className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted sm:text-[11px]"
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
                className="w-full rounded-[10px] border-[1.5px] border-line bg-white px-[13px] py-2.5 pl-[38px] font-sans text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#A8B0A5] focus:border-leaf focus:shadow-[0_0_0_4px_rgba(46,125,50,0.1)]"
              />
            </div>
          </div>

          <div className="auth-field mb-2.5 flex flex-col gap-1 sm:mb-3">
            <label
              htmlFor="password"
              className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted sm:text-[11px]"
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
                autoComplete="current-password"
                required
                className="w-full rounded-[10px] border-[1.5px] border-line bg-white px-[13px] py-2.5 pl-[38px] pr-[40px] font-sans text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#A8B0A5] focus:border-leaf focus:shadow-[0_0_0_4px_rgba(46,125,50,0.1)]"
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

          <div className="auth-rowbetween mb-3 flex items-center justify-between text-[12px] sm:mb-4 sm:text-[12.5px]">
            <label className="auth-remember flex items-center gap-1.5 text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-[14px] h-[14px] accent-leaf cursor-pointer"
              />
              Ingat saya
            </label>
            <Link href="/forgot-password" className="text-leaf font-semibold no-underline hover:underline">
              Lupa kata sandi?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="auth-btn flex w-full items-center justify-center gap-2 rounded-[10px] border-0 bg-leaf py-2.5 font-sans text-[13.5px] font-semibold text-white transition-[background,transform] duration-200 hover:bg-leaf-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Masuk sekarang
                <svg
                  viewBox="0 0 24 24"
                  width={15}
                  height={15}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="mt-3 text-center text-[12.5px] text-muted sm:mt-4 sm:text-[13px]">
          Belum punya akun?{" "}
          <Link href="/register" className="text-leaf font-semibold no-underline hover:underline">
            Daftar sekarang
          </Link>
        </p>
      </AuthShell>
      <ToastContainer />
    </>
  );
}

export default function OwnerLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
