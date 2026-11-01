"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { showToast, ToastContainer } from "@rakku/ui";
import AuthShell from "@/components/auth/AuthShell";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [tokenStatus, setTokenStatus] = useState<"checking" | "valid" | "invalid">(
    "checking"
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenStatus("invalid");
      return;
    }
    setTokenStatus("valid");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      showToast("error", "Password minimal 8 karakter");
      return;
    }
    if (password !== confirmPassword) {
      showToast("error", "Konfirmasi password tidak cocok");
      return;
    }
    if (!token) {
      showToast("error", "Token tidak valid");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/owner/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Reset kata sandi gagal");
        if (data.error?.toLowerCase().includes("token")) {
          setTokenStatus("invalid");
        }
        setIsLoading(false);
        return;
      }
      showToast("success", "Kata sandi berhasil diperbarui. Silakan masuk.");
      router.push("/login");
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthShell>
        {tokenStatus === "checking" ? (
          <div className="flex items-center justify-center py-10 text-muted text-sm">
            <span className="w-4 h-4 border-2 border-leaf/30 border-t-leaf rounded-full animate-spin mr-2" />
            Memvalidasi tautan...
          </div>
        ) : tokenStatus === "invalid" ? (
          <>
            <h2 className="font-serif font-medium text-[25px] tracking-[-0.01em] m-0 mb-1.5 text-ink">
              Tautan tidak valid
            </h2>
            <p className="text-[13.5px] text-muted m-0 mb-[26px] leading-[1.5]">
              Tautan reset kata sandi tidak valid atau sudah kadaluarsa. Minta tautan baru untuk melanjutkan.
            </p>
            <Link
              href="/forgot-password"
              className="auth-btn w-full py-[13px] rounded-[10px] bg-leaf text-white font-sans text-[13.5px] font-semibold no-underline text-center transition-[background,transform] duration-200 hover:bg-leaf-dark active:scale-[0.98] block"
            >
              Minta tautan baru
            </Link>
            <p className="text-center mt-5 text-[13px] text-muted">
              <Link href="/login" className="text-leaf font-semibold no-underline hover:underline">
                Kembali ke halaman masuk
              </Link>
            </p>
          </>
        ) : (
          <>
            <h2 className="font-serif font-medium text-[25px] tracking-[-0.01em] m-0 mb-1.5 text-ink">
              Buat kata sandi baru
            </h2>
            <p className="text-[13.5px] text-muted m-0 mb-[26px] leading-[1.5]">
              Kata sandi baru Anda harus berbeda dari kata sandi sebelumnya.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="auth-field flex flex-col gap-1.5 mb-[15px]">
                <label
                  htmlFor="password"
                  className="text-[11px] font-semibold tracking-[0.04em] uppercase text-muted"
                >
                  Kata sandi baru
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
                    placeholder="Kata sandi baru"
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

              <div className="auth-field flex flex-col gap-1.5 mb-[15px]">
                <label
                  htmlFor="confirm"
                  className="text-[11px] font-semibold tracking-[0.04em] uppercase text-muted"
                >
                  Konfirmasi kata sandi
                </label>
                <div className="auth-inputwrap relative flex items-center">
                  <svg
                    className="auth-icon absolute left-[13px] w-4 h-4 text-[#9AA39C] pointer-events-none"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Konfirmasi kata sandi"
                    autoComplete="new-password"
                    required
                    className="w-full py-[11px] px-[13px] pl-[38px] border-[1.5px] border-line rounded-[10px] font-sans text-[13.5px] text-ink bg-white transition-[border-color,box-shadow] duration-200 outline-none placeholder:text-[#A8B0A5] focus:border-leaf focus:shadow-[0_0_0_4px_rgba(46,125,50,0.1)]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="auth-btn w-full py-[13px] border-0 rounded-[10px] bg-leaf text-white font-sans text-[13.5px] font-semibold cursor-pointer flex items-center justify-center gap-2 transition-[background,transform] duration-200 hover:bg-leaf-dark active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Simpan kata sandi baru"
                )}
              </button>
            </form>
          </>
        )}
      </AuthShell>
      <ToastContainer />
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
