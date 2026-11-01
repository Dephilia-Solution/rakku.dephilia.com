"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Hash,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Store,
  X,
} from "lucide-react";
import { showToast, ToastContainer } from "@rakku/ui";
import { COMPANY_CODE_MAX_LENGTH, isValidCompanyCode, normalizeCompanyCode } from "@/lib/company-code";

type CodeAvailability = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

const steps = [
  { number: 1, title: "Perusahaan", description: "Nama, kode, dan akses kasir", icon: Building2 },
  { number: 2, title: "Outlet pertama", description: "Lokasi bisnis Anda", icon: Store },
] as const;

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [hasTransitioned, setHasTransitioned] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [companyCodeEdited, setCompanyCodeEdited] = useState(false);
  const [codeAvailability, setCodeAvailability] = useState<CodeAvailability>("idle");
  const [checkedCompanyCode, setCheckedCompanyCode] = useState("");
  const [companyPassword, setCompanyPassword] = useState("");
  const [showCompanyPassword, setShowCompanyPassword] = useState(false);
  const [outletName, setOutletName] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedCode, setSuggestedCode] = useState("");
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const codeToCheck = normalizeCompanyCode(companyCodeEdited ? companyCode : suggestedCode);

  useEffect(() => {
    const name = companyName.trim();
    if (!name) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/onboarding/company?name=${encodeURIComponent(name)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = await res.json();
        setSuggestedCode(typeof data.code === "string" ? data.code : "");
      } catch {
        if (!controller.signal.aborted) setSuggestedCode("");
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [companyName]);

  useEffect(() => {
    if (!codeToCheck || !isValidCompanyCode(codeToCheck)) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCodeAvailability("checking");
      try {
        const res = await fetch(
          `/api/onboarding/company?code=${encodeURIComponent(codeToCheck)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!res.ok) {
          if (!controller.signal.aborted) {
            setCheckedCompanyCode(codeToCheck);
            setCodeAvailability("error");
          }
          return;
        }
        const data = await res.json();
        if (controller.signal.aborted) return;
        setCheckedCompanyCode(codeToCheck);
        setCodeAvailability(data.available === true ? "available" : "taken");
      } catch {
        if (!controller.signal.aborted) {
          setCheckedCompanyCode(codeToCheck);
          setCodeAvailability("error");
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [codeToCheck]);

  const handleStep1Next = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyName.trim()) {
      showToast("error", "Nama perusahaan harus diisi");
      return;
    }
    if (!companyPassword || companyPassword.length < 6) {
      showToast("error", "Password perusahaan minimal 6 karakter");
      return;
    }
    if (!codeToCheck) {
      showToast("error", "Kode perusahaan harus diisi");
      return;
    }
    if (!isValidCompanyCode(codeToCheck)) {
      showToast("error", "Kode perusahaan hanya boleh berisi huruf dan angka");
      return;
    }
    if (codeAvailability === "taken") {
      showToast("error", "Kode perusahaan sudah digunakan. Silakan pilih kode lain.");
      return;
    }
    if (codeAvailability === "error") {
      showToast("error", "Ketersediaan kode belum dapat diperiksa. Coba lagi.");
      return;
    }
    if (codeAvailability !== "available" || checkedCompanyCode !== codeToCheck) {
      showToast("info", "Tunggu hingga pemeriksaan kode perusahaan selesai");
      return;
    }
    setHasTransitioned(true);
    setDirection(1);
    setStep(2);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
          companyCode: codeToCheck,
          companyPassword,
          outletName: outletName.trim(),
          outletAddress: outletAddress.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast("error", data.error || "Gagal membuat perusahaan");
        return;
      }

      showToast("success", "Perusahaan berhasil dibuat");
      router.replace(data.redirect || "/");
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setHasTransitioned(true);
    setDirection(-1);
    setStep(1);
  };

  const handleUseSuggestedCode = () => {
    setCompanyCodeEdited(false);
    setCompanyCode("");
    setCheckedCompanyCode("");
    setCodeAvailability("idle");
  };

  const codeStatusMessage = !codeToCheck
    ? companyCodeEdited
      ? "Isi kode perusahaan atau pilih kode saran."
      : "Kode otomatis muncul setelah nama perusahaan diisi."
    : codeAvailability === "checking"
    ? "Memeriksa ketersediaan kode..."
    : codeAvailability === "available" && checkedCompanyCode === codeToCheck
      ? "Kode perusahaan tersedia."
      : codeAvailability === "taken"
        ? "Kode sudah digunakan. Silakan pilih yang lain."
        : codeAvailability === "invalid"
          ? "Gunakan huruf A–Z dan angka 0–9 saja."
          : codeAvailability === "error"
            ? "Ketersediaan kode belum dapat diperiksa. Coba lagi."
            : companyCodeEdited
              ? "Kode akan diperiksa setelah Anda selesai mengetik."
              : "Kode dibuat dari nama perusahaan dan dapat diubah.";

  const codeStatusClass = codeAvailability === "available"
    ? "text-leaf"
    : codeAvailability === "taken" || codeAvailability === "invalid" || codeAvailability === "error"
      ? "text-[#B42318]"
      : "text-muted";

  return (
    <div className="min-h-dvh bg-cream text-ink">
      <header className="border-b border-line/80 bg-cream/90">
        <div className="mx-auto flex min-h-[60px] max-w-7xl items-center justify-between gap-4 px-4 sm:min-h-[68px] sm:px-7 lg:min-h-[76px] lg:px-10">
          <div className="flex shrink-0 items-center gap-2.5" aria-label="Rakku">
            <Image
              src="/images/rakku_logo.png"
              alt=""
              width={40}
              height={40}
              priority
              className="h-9 w-9 object-contain"
            />
            <Image
              src="/images/rakku_logotype.png"
              alt="Rakku"
              width={112}
              height={34}
              priority
              className="h-[25px] w-auto"
            />
          </div>
          <p className="text-right text-xs font-medium text-muted sm:text-sm">
            Penyiapan akun owner
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl items-start gap-5 px-4 py-4 sm:px-7 sm:py-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12 lg:px-10 lg:py-10">
        <aside className="lg:sticky lg:top-10 lg:self-start">
          <div className="max-w-xl">
            <p className="mb-3 hidden text-xs font-bold uppercase tracking-[0.13em] text-leaf lg:mb-4 lg:block">
              Mulai di sini
            </p>
            <h1 className="text-balance max-w-[13ch] font-serif text-[26px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-4xl lg:text-5xl lg:tracking-[-0.035em]">
              Bisnis Anda, siap dikelola.
            </h1>
            <p className="mt-4 hidden max-w-[46ch] text-[15px] leading-7 text-muted lg:block">
              Lengkapi data perusahaan dan outlet pertama. Detail lainnya bisa Anda atur setelah masuk ke Rakku.
            </p>

            <ol aria-label="Progres penyiapan akun" className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 lg:mt-10 lg:grid-cols-1 lg:gap-3">
              {steps.map(({ number, title, description, icon: StepIcon }) => {
                const active = step === number;
                const complete = step > number;

                return (
                  <li key={number} aria-current={active ? "step" : undefined}>
                    <div
                      className={`flex min-h-[62px] items-center gap-2.5 rounded-2xl border px-2.5 py-2.5 transition-colors duration-200 sm:min-h-[68px] sm:gap-3 sm:px-3.5 lg:min-h-[76px] lg:gap-3.5 lg:px-4 lg:py-3 ${
                        active
                          ? "border-leaf/25 bg-white shadow-[0_8px_24px_-18px_rgba(27,79,31,0.45)]"
                          : "border-transparent bg-transparent"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 lg:h-10 lg:w-10 ${
                          active || complete ? "bg-leaf text-white" : "bg-white/80 text-muted"
                        }`}
                      >
                        {complete ? <Check size={18} aria-hidden="true" /> : <StepIcon size={18} aria-hidden="true" />}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-xs font-semibold leading-4 sm:text-[13px] lg:text-sm lg:leading-normal ${active ? "text-ink" : "text-muted"}`}>
                          {title}
                        </span>
                        <span className="sr-only mt-0.5 block text-xs leading-5 text-muted lg:not-sr-only">
                          {description}
                        </span>
                      </span>
                      <span className="ml-auto hidden font-mono text-[11px] tabular-nums text-muted lg:block">
                        0{number}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-7 hidden items-start gap-3 border-t border-line pt-5 lg:mt-9 lg:flex">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <LockKeyhole size={16} aria-hidden="true" />
              </span>
              <p className="max-w-sm text-xs leading-5 text-muted">
                Kode perusahaan dan kata sandi ini akan digunakan kasir saat masuk.
              </p>
            </div>
          </div>
        </aside>

        <section aria-label="Form penyiapan bisnis" className="min-w-0">
          <div className="overflow-hidden rounded-[24px] border border-line bg-white shadow-[0_24px_64px_-42px_rgba(27,79,31,0.32),0_3px_10px_rgba(26,26,26,0.035)] sm:rounded-[28px]">
            <div className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-3 sm:px-7 sm:py-4">
              <p className="text-sm font-semibold text-ink">Penyiapan bisnis</p>
              <p className="font-mono text-xs font-medium tabular-nums text-muted">
                <span className="text-leaf">0{step}</span> / 02
              </p>
              <span role="status" aria-live="polite" className="sr-only">
                Langkah {step} dari 2: {step === 1 ? "Informasi perusahaan" : "Outlet pertama"}
              </span>
            </div>

            <motion.div
              key={step}
              initial={
                hasTransitioned && !prefersReducedMotion
                  ? { opacity: 0, x: direction > 0 ? 26 : -26 }
                  : false
              }
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.34, ease: "easeOut" }}
              className="min-h-0 p-4 sm:p-6 lg:min-h-[420px] lg:p-8"
            >
                {step === 1 ? (
                  <form
                    onSubmit={handleStep1Next}
                    aria-labelledby="onboarding-form-title"
                    className="space-y-4 sm:space-y-5"
                  >
                    <div>
                      <h2 id="onboarding-form-title" className="font-serif text-[22px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[28px]">
                        Informasi perusahaan
                      </h2>
                      <p className="mt-1.5 max-w-[48ch] text-[13px] leading-5 text-muted sm:mt-2 sm:text-sm sm:leading-6">
                        Atur identitas bisnis dan akses yang dipakai tim kasir.
                      </p>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <label htmlFor="company-name" className="block text-xs font-semibold text-ink sm:text-[13px]">
                        Nama perusahaan
                      </label>
                      <div className="group relative">
                        <Building2
                          size={18}
                          aria-hidden="true"
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-leaf"
                        />
                        <input
                          id="company-name"
                          type="text"
                          value={companyName}
                          onChange={(event) => {
                            setCompanyName(event.target.value);
                            setSuggestedCode("");
                            if (!companyCodeEdited) {
                              setCheckedCompanyCode("");
                              setCodeAvailability("idle");
                            }
                          }}
                          placeholder="Contoh: Kedai Pagi"
                          autoComplete="organization"
                          maxLength={120}
                          required
                          className="h-12 w-full rounded-xl border border-line bg-[#FAFBF9] pl-11 pr-4 text-sm text-ink outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-[#66716A] focus:border-leaf focus:bg-white focus:ring-4 focus:ring-leaf/10 sm:h-[52px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor="company-code" className="block text-xs font-semibold text-ink sm:text-[13px]">
                          Kode perusahaan
                        </label>
                        {companyCodeEdited && suggestedCode && (
                          <button
                            type="button"
                            onClick={handleUseSuggestedCode}
                            className="shrink-0 text-[11px] font-semibold text-leaf underline decoration-leaf/30 underline-offset-2 hover:decoration-leaf"
                          >
                            Pakai saran
                          </button>
                        )}
                      </div>
                      <div className="group relative">
                        <Hash
                          size={18}
                          aria-hidden="true"
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-leaf"
                        />
                        <input
                          id="company-code"
                          type="text"
                          value={codeToCheck}
                          onChange={(event) => {
                            const value = event.target.value.toUpperCase();
                            setCompanyCode(value);
                            setCompanyCodeEdited(true);
                            setCheckedCompanyCode("");
                            setCodeAvailability(
                              value && !isValidCompanyCode(normalizeCompanyCode(value))
                                ? "invalid"
                                : "idle",
                            );
                          }}
                          placeholder="Dibuat dari nama perusahaan"
                          autoComplete="off"
                          autoCapitalize="characters"
                          spellCheck={false}
                          maxLength={COMPANY_CODE_MAX_LENGTH}
                          aria-describedby="company-code-help"
                          aria-invalid={codeAvailability === "invalid" || codeAvailability === "taken"}
                          className="h-12 w-full rounded-xl border border-line bg-[#FAFBF9] pl-11 pr-4 font-mono text-sm font-semibold tracking-[0.04em] text-ink outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-[#66716A] focus:border-leaf focus:bg-white focus:ring-4 focus:ring-leaf/10 sm:h-[52px]"
                        />
                      </div>
                      <p
                        id="company-code-help"
                        role="status"
                        aria-live="polite"
                        className={`flex min-h-4 items-center gap-1.5 text-[11px] leading-4 sm:text-xs sm:leading-5 ${codeStatusClass}`}
                      >
                        {codeAvailability === "checking" && (
                          <LoaderCircle
                            size={13}
                            aria-hidden="true"
                            className={prefersReducedMotion ? undefined : "animate-spin"}
                          />
                        )}
                        {codeAvailability === "available" && checkedCompanyCode === codeToCheck && (
                          <Check size={13} aria-hidden="true" />
                        )}
                        {(codeAvailability === "taken" || codeAvailability === "invalid" || codeAvailability === "error") && (
                          <X size={13} aria-hidden="true" />
                        )}
                        <span>{codeStatusMessage}</span>
                      </p>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <label htmlFor="company-password" className="block text-xs font-semibold text-ink sm:text-[13px]">
                        Kata sandi perusahaan
                      </label>
                      <div className="group relative">
                        <LockKeyhole
                          size={18}
                          aria-hidden="true"
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-leaf"
                        />
                        <input
                          id="company-password"
                          type={showCompanyPassword ? "text" : "password"}
                          value={companyPassword}
                          onChange={(event) => setCompanyPassword(event.target.value)}
                          placeholder="Minimal 6 karakter"
                          autoComplete="new-password"
                          minLength={6}
                          required
                          className="onboarding-password-input h-12 w-full rounded-xl border border-line bg-[#FAFBF9] pl-11 pr-12 text-sm text-ink outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-[#66716A] focus:border-leaf focus:bg-white focus:ring-4 focus:ring-leaf/10 sm:h-[52px]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCompanyPassword((visible) => !visible)}
                          aria-label={showCompanyPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                          aria-pressed={showCompanyPassword}
                          className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-cream hover:text-leaf focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-leaf"
                        >
                          {showCompanyPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                        </button>
                      </div>
                      <p className="text-[11px] leading-4 text-muted sm:text-xs sm:leading-5">
                        Digunakan kasir saat masuk. Minimal 6 karakter.
                      </p>
                    </div>

                    <button
                      type="submit"
                      className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-leaf px-5 text-sm font-semibold text-white transition-[background-color,transform,box-shadow] duration-200 hover:bg-leaf-dark hover:shadow-[0_8px_20px_-10px_rgba(27,79,31,0.7)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf sm:min-h-[52px]"
                    >
                      Lanjut ke outlet
                      <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                  </form>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    aria-labelledby="onboarding-form-title"
                    className="space-y-4 sm:space-y-5"
                  >
                    <div>
                      <h2 id="onboarding-form-title" className="font-serif text-[22px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[28px]">
                        Outlet pertama
                      </h2>
                      <p className="mt-1.5 max-w-[48ch] text-[13px] leading-5 text-muted sm:mt-2 sm:text-sm sm:leading-6">
                        Tambahkan lokasi utama bisnis Anda. Outlet lain bisa ditambahkan nanti.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-line bg-[#F8FAF7] px-3 py-2.5 sm:px-4 sm:py-3.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-leaf">
                        <Building2 size={17} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-medium text-muted">Perusahaan</span>
                        <span className="block truncate text-sm font-semibold text-ink">{companyName.trim()}</span>
                      </span>
                      <span className="hidden max-w-[42%] truncate rounded-md bg-white px-2 py-1 font-mono text-[11px] font-semibold text-muted sm:block">
                        {codeToCheck || "Kode otomatis"}
                      </span>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <label htmlFor="outlet-name" className="block text-xs font-semibold text-ink sm:text-[13px]">
                        Nama outlet
                      </label>
                      <div className="group relative">
                        <Store
                          size={18}
                          aria-hidden="true"
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-leaf"
                        />
                        <input
                          id="outlet-name"
                          type="text"
                          value={outletName}
                          onChange={(event) => setOutletName(event.target.value)}
                          placeholder="Contoh: Outlet utama"
                          autoComplete="organization"
                          maxLength={120}
                          required
                          className="h-12 w-full rounded-xl border border-line bg-[#FAFBF9] pl-11 pr-4 text-sm text-ink outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-[#66716A] focus:border-leaf focus:bg-white focus:ring-4 focus:ring-leaf/10 sm:h-[52px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <label htmlFor="outlet-address" className="block text-xs font-semibold text-ink sm:text-[13px]">
                        Alamat outlet <span className="font-normal text-muted">(opsional)</span>
                      </label>
                      <div className="group relative">
                        <MapPin
                          size={18}
                          aria-hidden="true"
                          className="absolute left-3.5 top-[18px] text-muted transition-colors group-focus-within:text-leaf"
                        />
                        <textarea
                          id="outlet-address"
                          value={outletAddress}
                          onChange={(event) => setOutletAddress(event.target.value)}
                          placeholder="Jalan, nomor, kota"
                          autoComplete="street-address"
                          rows={2}
                          className="w-full resize-y rounded-xl border border-line bg-[#FAFBF9] py-3 pl-11 pr-4 text-sm leading-6 text-ink outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-[#66716A] focus:border-leaf focus:bg-white focus:ring-4 focus:ring-leaf/10 sm:py-3.5"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleBack}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-muted transition-[background-color,border-color,color,transform] duration-200 hover:border-leaf/30 hover:bg-cream hover:text-ink active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf sm:min-h-[52px] sm:px-4"
                      >
                        <ArrowLeft size={16} aria-hidden="true" />
                        Kembali
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-leaf px-4 text-sm font-semibold text-white transition-[background-color,transform,box-shadow] duration-200 hover:bg-leaf-dark hover:shadow-[0_8px_20px_-10px_rgba(27,79,31,0.7)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:cursor-wait disabled:opacity-65 sm:min-h-[52px] sm:px-5"
                      >
                        {isLoading ? (
                          <>
                            <LoaderCircle
                              size={17}
                              aria-hidden="true"
                              className={prefersReducedMotion ? undefined : "animate-spin"}
                            />
                            Menyiapkan bisnis
                          </>
                        ) : (
                          <>
                            Selesaikan
                            <Check size={17} aria-hidden="true" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
            </motion.div>
          </div>

          <p className="mt-3 px-1 text-center text-[11px] leading-4 text-muted sm:mt-4 sm:text-left sm:text-xs sm:leading-5">
            Baca juga{" "}
            <Link href="/terms" className="font-semibold text-leaf underline decoration-leaf/30 underline-offset-2 hover:decoration-leaf">
              Syarat dan Ketentuan
            </Link>
            {" serta "}
            <Link href="/privacy" className="font-semibold text-leaf underline decoration-leaf/30 underline-offset-2 hover:decoration-leaf">
              Kebijakan Privasi
            </Link>
            {" Rakku."}
          </p>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 pb-6 text-[11px] text-muted sm:px-7 lg:px-10">
        <span>Rakku POS · Penyiapan akun bisnis</span>
        <span>Tier Dine In dan Take Away dibuat otomatis. Akses karyawan bisa diatur setelah masuk.</span>
      </footer>

      <ToastContainer />
    </div>
  );
}
