"use client";

import { useState } from "react";
import Link from "next/link";
import { Store, Mail, ArrowLeft } from "lucide-react";
import { showToast } from "@/components/shared/Toast";
import ToastContainer from "@/components/shared/Toast";

export default function CekEmailPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) {
      showToast("error", "Masukkan email Anda");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/owner/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Gagal mengirim ulang");
        setIsLoading(false);
        return;
      }
      setResent(true);
      showToast("success", "Email verifikasi telah dikirim ulang");
      setIsLoading(false);
    } catch {
      showToast("error", "Terjadi kesalahan");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff] px-6">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-forest rounded-xl flex items-center justify-center text-white">
            <Store size={22} />
          </div>
          <span className="text-2xl font-extrabold text-forest">Rakku</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8">
          <div className="w-14 h-14 bg-forest/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={28} className="text-forest" />
          </div>

          <h1 className="text-xl font-bold text-neutral-900 mb-2">
            Cek Email Anda
          </h1>
          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
            Kami telah mengirimkan link verifikasi ke email Anda. Silakan buka
            inbox dan klik tombol Verifikasi untuk melanjutkan.
          </p>

          {resent ? (
            <div className="bg-success/10 text-success text-sm rounded-xl p-4 mb-4">
              Email verifikasi telah dikirim ulang. Cek inbox Anda.
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Anda"
                className="w-full h-11 px-4 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/10 transition-all"
              />
              <button
                onClick={handleResend}
                disabled={isLoading}
                className="w-full h-11 bg-forest/10 text-forest font-semibold text-sm rounded-xl hover:bg-forest/20 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
                ) : (
                  "Kirim Ulang Email"
                )}
              </button>
            </div>
          )}
        </div>

        <Link
          href="/owner/masuk"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 mt-6 hover:text-forest transition-colors"
        >
          <ArrowLeft size={16} />
          Kembali ke Login
        </Link>
      </div>

      <ToastContainer />
    </div>
  );
}
