"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Shield } from "lucide-react";
import { showToast } from "@/components/shared/Toast";
import ToastContainer from "@/components/shared/Toast";
import { createClient } from "@/lib/supabase/client";

export default function SuperadminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast("error", "Email dan password harus diisi");
      return;
    }
    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showToast("error", error.message);
      setIsLoading(false);
      return;
    }

    showToast("success", "Login berhasil");
    router.push("/superadmin/companies");
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-forest rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm overflow-hidden">
            <Image src="/images/rakku_logo.png" alt="Rakku" width={56} height={56} className="w-full h-full object-cover" />
          </div>
          <Image
            src="/images/rakku_logotype.png"
            alt="Rakku"
            width={160}
            height={40}
            className="h-8 w-auto mx-auto object-contain"
          />
          <p className="text-sm text-neutral-400 mt-2">
            Panel Superadmin
          </p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
              Email Superadmin
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@rakku.id"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-forest text-white rounded-xl px-6 py-3 font-semibold text-sm hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Shield size={16} />
                Masuk sebagai Superadmin
              </>
            )}
          </button>
        </form>
      </div>
      <ToastContainer />
    </div>
  );
}
