"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Building2,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Check,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { showToast, ToastContainer } from "@rakku/ui";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [companyPassword, setCompanyPassword] = useState("");
  const [showCompanyPassword, setShowCompanyPassword] = useState(false);
  const [outletName, setOutletName] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedCode, setSuggestedCode] = useState("");
  const router = useRouter();

  // Fetch suggested code saat company name berubah (debounced)
  useEffect(() => {
    if (!companyName) {
      setSuggestedCode("");
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/onboarding/company?name=${encodeURIComponent(companyName)}`
        );
        const data = await res.json();
        setSuggestedCode(data.code || "");
      } catch {
        // ignore
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [companyName]);

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      showToast("error", "Nama perusahaan harus diisi");
      return;
    }
    if (!companyPassword || companyPassword.length < 6) {
      showToast("error", "Password perusahaan minimal 6 karakter");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletName.trim()) {
      showToast("error", "Nama outlet harus diisi");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/onboarding/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          companyCode: companyCode || suggestedCode,
          companyPassword,
          outletName: outletName.trim(),
          outletAddress: outletAddress.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast("error", data.error || "Gagal membuat perusahaan");
        setIsLoading(false);
        return;
      }

      showToast("success", "Perusahaan berhasil dibuat!");
      router.push("/dashboard");
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-forest/5 p-4">
      <div className="w-full max-w-2xl">
        {/* Brand Header */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-10 h-10 bg-forest rounded-xl flex items-center justify-center text-white shadow-lg">
            <Store size={22} />
          </div>
          <span className="text-2xl font-bold text-forest tracking-tight">
            Rakku
          </span>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step >= s
                    ? "bg-forest text-white"
                    : "bg-neutral-200 text-neutral-400"
                }`}
              >
                {step > s ? <Check size={16} /> : s}
              </div>
              {s < 2 && (
                <div
                  className={`w-16 h-1 rounded-full transition-all ${
                    step > s ? "bg-forest" : "bg-neutral-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl form-card-shadow border border-neutral-200 p-6 lg:p-8">
          {step === 1 ? (
            <form onSubmit={handleStep1Next} className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-neutral-900">
                  Data Bisnis Anda
                </h1>
                <p className="text-sm text-neutral-400">
                  Isi informasi perusahaan Anda. Ini akan dipakai untuk login
                  kasir 4-step.
                </p>
              </div>

              {/* Company Name */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Nama Perusahaan
                </label>
                <div className="relative group">
                  <Building2
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-forest transition-colors"
                  />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Mis. Kopi Kita"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent rounded-xl text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                  />
                </div>
              </div>

              {/* Company Code (auto-suggest) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Kode Perusahaan
                </label>
                <div className="relative group">
                  <Building2
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-forest transition-colors"
                  />
                  <input
                    type="text"
                    value={companyCode || suggestedCode}
                    onChange={(e) =>
                      setCompanyCode(e.target.value.toUpperCase())
                    }
                    placeholder="KOPIKITA"
                    className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent rounded-xl text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-forest focus:ring-1 focus:ring-forest transition-all uppercase"
                  />
                </div>
                <p className="text-xs text-neutral-400">
                  Kode unik untuk login kasir. Otomatis dibuat dari nama, bisa
                  diubah.
                </p>
              </div>

              {/* Company Password */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Password Perusahaan
                </label>
                <div className="relative group">
                  <Lock
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-forest transition-colors"
                  />
                  <input
                    type={showCompanyPassword ? "text" : "password"}
                    value={companyPassword}
                    onChange={(e) => setCompanyPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-11 pr-11 py-3 bg-neutral-50 border border-transparent rounded-xl text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCompanyPassword(!showCompanyPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-forest transition-colors"
                  >
                    {showCompanyPassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
                <p className="text-xs text-neutral-400">
                  Dipakai kasir di langkah 1 login. Minimal 6 karakter.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-forest hover:bg-forest-dark text-white font-bold text-base rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Lanjut
                <ArrowRight size={18} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-neutral-900">
                  Outlet Pertama
                </h1>
                <p className="text-sm text-neutral-400">
                  Buat outlet/cabang pertama Anda. Bisa tambah lagi nanti.
                </p>
              </div>

              {/* Outlet Name */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Nama Outlet
                </label>
                <div className="relative group">
                  <Store
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-forest transition-colors"
                  />
                  <input
                    type="text"
                    value={outletName}
                    onChange={(e) => setOutletName(e.target.value)}
                    placeholder="Outlet Utama"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent rounded-xl text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                  />
                </div>
              </div>

              {/* Outlet Address */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Alamat Outlet{" "}
                  <span className="text-neutral-400 normal-case font-normal">
                    (opsional)
                  </span>
                </label>
                <div className="relative group">
                  <MapPin
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-forest transition-colors"
                  />
                  <textarea
                    value={outletAddress}
                    onChange={(e) => setOutletAddress(e.target.value)}
                    placeholder="Jl. Contoh No. 1, Jakarta"
                    rows={3}
                    className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent rounded-xl text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-forest focus:ring-1 focus:ring-forest transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold text-base rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-4 bg-forest hover:bg-forest-dark text-white font-bold text-base rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={18} />
                      Selesaikan
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Info Note */}
        <p className="text-center text-xs text-neutral-400 mt-6 max-w-md mx-auto">
          Setelah onboarding selesai, sistem membuatkan pricing tier (Dine In,
          Take Away) otomatis. Role & akses karyawan bisa Anda atur di menu
          Karyawan.
        </p>
      </div>

      <ToastContainer />
    </div>
  );
}
