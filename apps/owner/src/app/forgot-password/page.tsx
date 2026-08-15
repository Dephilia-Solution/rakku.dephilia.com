"use client";

import { useState } from "react";
import Link from "next/link";
import { showToast, ToastContainer } from "@rakku/ui";
import AuthShell from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showToast("error", "Email harus diisi");
      return;
    }
    setIsLoading(true);
    try {
      await fetch("/api/auth/owner/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
      showToast("success", "Jika email terdaftar, link reset telah dikirim.");
    } catch {
      setSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthShell>
        <h2 className="font-serif font-medium text-[25px] tracking-[-0.01em] m-0 mb-1.5 text-ink">
          Lupa kata sandi?
        </h2>
        <p className="text-[13.5px] text-muted m-0 mb-[26px] leading-[1.5]">
          Masukkan email Anda dan kami akan mengirim link untuk mengatur ulang kata sandi.
        </p>

        {sent ? (
          <div className="rounded-[10px] border border-line bg-cream/60 p-4 text-[13px] text-muted leading-[1.5]">
            Link reset kata sandi telah dikirim ke <b className="text-ink">{email}</b>.
            Silakan cek inbox (atau folder spam) Anda. Link berlaku selama 1 jam.
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
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

            <button
              type="submit"
              disabled={isLoading}
              className="auth-btn w-full py-[13px] border-0 rounded-[10px] bg-leaf text-white font-sans text-[13.5px] font-semibold cursor-pointer flex items-center justify-center gap-2 transition-[background,transform] duration-200 hover:bg-leaf-dark active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Kirim link reset"
              )}
            </button>
          </form>
        )}

        <p className="text-center mt-5 text-[13px] text-muted">
          Ingat kata sandi Anda?{" "}
          <Link href="/login" className="text-leaf font-semibold no-underline hover:underline">
            Masuk di sini
          </Link>
        </p>
      </AuthShell>
      <ToastContainer />
    </>
  );
}
