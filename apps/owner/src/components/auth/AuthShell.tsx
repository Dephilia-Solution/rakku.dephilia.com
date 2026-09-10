"use client";

import Image from "next/image";
import type { ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
  reverse?: boolean;
}

export default function AuthShell({ children, reverse = false }: AuthShellProps) {
  return (
    <main className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-cream p-3 sm:p-5 lg:p-6">
      <div className="auth-shell flex h-full w-full max-w-[960px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-24px_rgba(27,79,31,0.24),0_2px_8px_rgba(0,0,0,0.03)] sm:max-h-[620px] lg:flex-row">
        <aside
          className={`auth-panel relative hidden overflow-hidden bg-[linear-gradient(160deg,#1B4F1F_0%,#2E7D32_62%)] p-8 text-white lg:flex lg:flex-1 lg:flex-col lg:justify-center ${
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

          <div className="auth-copy relative z-[2] max-w-[320px]">
            <span className="auth-eyebrow block text-xs font-semibold tracking-[0.08em] uppercase text-moss mb-3">
              Sistem POS Modern
            </span>
            <h1 className="m-0 mb-3 font-serif text-[27px] font-medium leading-[1.2] tracking-[-0.015em]">
              Setiap transaksi, tersusun rapi di raknya.
            </h1>
            <p className="text-[14px] leading-[1.6] text-white/78 m-0">
              Kelola kasir, stok, dan laporan dalam satu tempat — dibangun untuk
              ritme bisnis kuliner dan retail sehari-hari.
            </p>
          </div>
        </aside>

        <section
          className={`auth-form-side flex min-h-0 flex-1 flex-col justify-center px-4 py-3 max-[359px]:px-3 max-[359px]:py-2 sm:px-8 sm:py-6 lg:p-10 ${
            reverse ? "lg:order-1" : "lg:order-2"
          }`}
        >
          <div className="auth-form-inner mx-auto w-full max-w-[340px]">
            <div className="auth-brand mb-4 flex items-center gap-2 max-[359px]:mb-3 sm:mb-5">
              <Image
                src="/images/rakku_logo.png"
                alt="Rakku"
                width={30}
                height={30}
                priority
                className="h-[30px] w-[30px] object-contain"
              />
              <Image
                src="/images/rakku_logotype.png"
                alt="Rakku"
                width={94}
                height={24}
                priority
                className="h-6 w-auto"
              />
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
