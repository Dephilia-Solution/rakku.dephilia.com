"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Coffee, ShieldAlert, LogOut } from "lucide-react";

export default function EnterPinPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
      </div>
    }>
      <EnterPinPage />
    </Suspense>
  );
}

function EnterPinPage() {
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("user_id");

  useEffect(() => {
    if (!userId) {
      router.push("/login");
    }
    inputRefs.current[0]?.focus();
  }, [userId, router]);

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (index === 5 && value) {
      const fullPin = [...newPin.slice(0, 5), value].join("");
      submitPin(fullPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const newPin = [...pin];
    for (let i = 0; i < text.length; i++) {
      newPin[i] = text[i];
    }
    setPin(newPin);
    if (text.length === 6) {
      submitPin(text);
    } else {
      inputRefs.current[text.length]?.focus();
    }
  };

  const submitPin = async (fullPin: string) => {
    if (fullPin.length !== 6 || !userId) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/tenant/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: fullPin, user_id: userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "PIN salah");
        setPin(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setIsLoading(false);
        return;
      }

      router.push(data.redirect || "/register");
    } catch {
      setError("Terjadi kesalahan, coba lagi");
      setPin(["", "", "", "", "", ""]);
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
            Masukkan PIN
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            PIN 6 digit untuk verifikasi akun
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex justify-center gap-3" onPaste={handlePaste}>
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={isLoading}
                className="w-11 h-12 text-center text-lg font-bold bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest disabled:opacity-50"
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-danger text-sm justify-center">
              <ShieldAlert size={16} />
              {error}
            </div>
          )}

          <button
            onClick={() => {
              const fullPin = pin.join("");
              if (fullPin.length === 6) submitPin(fullPin);
            }}
            disabled={isLoading || pin.join("").length !== 6}
            className="w-full bg-forest text-white rounded-xl px-6 py-3 font-semibold text-sm hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Verifikasi PIN"
            )}
          </button>
        </div>

        <form action="/api/auth/tenant/logout" method="post" className="mt-6">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 text-sm text-neutral-400 hover:text-danger py-2 transition-colors"
          >
            <LogOut size={16} />
            Batalkan & kembali
          </button>
        </form>
      </div>
    </div>
  );
}
