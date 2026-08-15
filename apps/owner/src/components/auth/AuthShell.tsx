"use client";

import Image from "next/image";
import type { ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
  reverse?: boolean;
}

export default function AuthShell({ children, reverse = false }: AuthShellProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-6">
      <div className="auth-shell w-full max-w-[1080px] min-h-[640px] flex flex-col lg:flex-row bg-white rounded-3xl overflow-hidden shadow-[0_30px_80px_-20px_rgba(27,79,31,0.22),0_2px_8px_rgba(0,0,0,0.04)]">
        <aside
          className={`auth-panel relative flex flex-col justify-center p-7 lg:p-10 text-white overflow-hidden bg-[linear-gradient(160deg,#1B4F1F_0%,#2E7D32_62%)] min-h-[200px] lg:min-h-0 lg:flex-1 ${
            reverse ? "lg:order-2" : "lg:order-1"
          }`}
        >
          <div className="auth-shelf absolute right-[-6%] bottom-[-4%] w-[92%] flex flex-col gap-6 pointer-events-none" aria-hidden="true">
            <div className="auth-rail relative h-[2px] bg-white/[0.13]">
              <span className="auth-block absolute bottom-[2px] rounded-lg bg-white/[0.08] left-[4%] w-[42px] h-[42px]" />
              <span className="auth-block absolute bottom-[2px] rounded-lg bg-white/[0.08] left-[16%] w-[32px] h-[32px]" />
              <span className="auth-block auth-block-on absolute bottom-[2px] rounded-lg bg-moss left-[26%] w-[24px] h-[50px]" />
              <span className="auth-block absolute bottom-[2px] rounded-lg bg-white/[0.08] left-[35%] w-[36px] h-[36px]" />
              <span className="auth-block absolute bottom-[2px] rounded-lg bg-white/[0.08] left-[47%] w-[28px] h-[28px]" />
              <span className="auth-block absolute bottom-[2px] rounded-lg bg-white/[0.08] left-[58%] w-[40px] h-[40px]" />
            </div>
            <div className="auth-rail relative h-[2px] bg-white/[0.13]">
              <span className="auth-block absolute bottom-[2px] rounded-lg bg-white/[0.08] left-[10%] w-[38px] h-[38px]" />
              <span className="auth-block absolute bottom-[2px] rounded-lg bg-white/[0.08] left-[22%] w-[48px] h-[48px]" />
              <span className="auth-block absolute bottom-[2px] rounded-lg bg-white/[0.08] left-[36%] w-[26px] h-[26px]" />
              <span className="auth-block auth-block-on absolute bottom-[2px] rounded-lg bg-moss left-[47%] w-[34px] h-[34px]" />
              <span className="auth-block absolute bottom-[2px] rounded-lg bg-white/[0.08] left-[60%] w-[22px] h-[22px]" />
            </div>
          </div>

          <div className="auth-copy relative z-[2] max-w-[360px] hidden lg:block">
            <span className="auth-eyebrow block text-xs font-semibold tracking-[0.08em] uppercase text-moss mb-3">
              Sistem POS Modern
            </span>
            <h1 className="font-serif font-medium text-[30px] leading-[1.22] tracking-[-0.01em] m-0 mb-3">
              Setiap transaksi, tersusun rapi di raknya.
            </h1>
            <p className="text-[14px] leading-[1.6] text-white/78 m-0">
              Kelola kasir, stok, dan laporan dalam satu tempat — dibangun untuk
              ritme bisnis kuliner dan retail sehari-hari.
            </p>
          </div>
        </aside>

        <section
          className={`auth-form-side p-8 sm:p-11 lg:p-12 flex flex-col justify-center lg:flex-1 ${
            reverse ? "lg:order-1" : "lg:order-2"
          }`}
        >
          <div className="auth-form-inner w-full max-w-[340px] mx-auto">
            <div className="auth-brand flex items-center gap-2.5 mb-8">
              <Image
                src="/images/rakku_logo.png"
                alt="Rakku"
                width={36}
                height={36}
                priority
                className="w-9 h-9 object-contain"
              />
              <Image
                src="/images/rakku_logotype.png"
                alt="Rakku"
                width={110}
                height={28}
                priority
                className="h-7 w-auto"
              />
            </div>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
