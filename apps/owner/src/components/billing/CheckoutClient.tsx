"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, MerchantLink as Link, useMerchantRequest, useMerchantRuntime, useMerchantToast } from "@/lib/merchant-runtime";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";

interface CheckoutInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  billing_cycle: string;
  status: string;
  qr_string: string | null;
  expired_at: string | null;
}

function formatRupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function CheckoutClient({
  invoice,
  planName,
}: {
  invoice: CheckoutInvoice;
  planName: string;
}) {
  const request = useMerchantRequest();
  const showToast = useMerchantToast();
  const runtime = useMerchantRuntime();
  const isActive = runtime?.active;
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const lifetime = useRef<AbortController | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifiedSuccess = useRef(false);
  const [status, setStatus] = useState(invoice.status);
  const [now, setNow] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    notifiedSuccess.current = false;
    return () => {
      controller.abort();
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [request, isActive, invoice.id]);

  useEffect(() => {
    if (isActive?.() === false) return;
    setNow(Date.now());
    const ticker = setInterval(() => {
      if (isActive?.() !== false) setNow(Date.now());
    }, 1000);
    return () => clearInterval(ticker);
  }, [isActive]);

  const paymentSucceeded = useCallback((signal: AbortSignal) => {
    if (signal.aborted || isActive?.() === false || notifiedSuccess.current) return;
    const lifetimeSignal = lifetime.current?.signal;
    if (!lifetimeSignal || lifetimeSignal.aborted) return;
    notifiedSuccess.current = true;
    showToast("success", "Pembayaran berhasil! Paket diaktifkan.");
    redirectTimer.current = setTimeout(() => {
      if (!lifetimeSignal.aborted && isActive?.() !== false) routerRef.current.push("/subscription");
    }, 1200);
  }, [showToast, isActive]);

  const refresh = useCallback(async (signal: AbortSignal) => {
    if (signal.aborted || isActive?.() === false) return;
    try {
      const res = await request(
        `/api/owner/subscription/invoices/${invoice.id}`,
        { cache: "no-store", signal }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (signal.aborted || isActive?.() === false) return;
      setStatus(data.invoice?.status ?? "pending");
      if (data.invoice?.status === "success") {
        paymentSucceeded(signal);
      }
    } catch {
      // diamkan, coba lagi di polling berikutnya
    }
  }, [invoice.id, request, isActive, paymentSucceeded]);

  useEffect(() => {
    if (status !== "pending" || isActive?.() === false) return;
    const controller = new AbortController();
    const poll = setInterval(() => { void refresh(controller.signal); }, 5000);
    return () => {
      clearInterval(poll);
      controller.abort();
    };
  }, [status, refresh, isActive]);

  const handleSync = async () => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || isActive?.() === false) return;
    setSyncing(true);
    try {
      const res = await request(
        `/api/owner/subscription/invoices/${invoice.id}/sync`,
        { method: "POST", signal }
      );
      const data = await res.json().catch(() => ({}));
      if (signal.aborted || isActive?.() === false) return;
      if (!res.ok) {
        showToast("error", data.error || "Gagal cek status");
        return;
      }
      setStatus(data.invoice?.status ?? "pending");
      if (data.invoice?.status === "success") {
        paymentSucceeded(signal);
      } else {
        showToast("info", "Pembayaran belum terdeteksi. Coba lagi sebentar.");
      }
    } catch {
      if (signal.aborted || isActive?.() === false) return;
      showToast("error", "Terjadi kesalahan, coba lagi");
    } finally {
      if (!signal.aborted && isActive?.() !== false) setSyncing(false);
    }
  };

  const remaining =
    now && invoice.expired_at
      ? new Date(invoice.expired_at).getTime() - now
      : null;
  const isExpired = status === "expired" || (remaining !== null && remaining <= 0);
  const isSuccess = status === "success";
  const isFailed = status === "failed" || status === "cancelled";

  return (
    <div className="max-w-lg mx-auto">
      <Link
        href="/subscription"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 mb-4"
      >
        <ArrowLeft size={16} />
        Kembali ke Langganan
      </Link>

      <div className="bg-white rounded-2xl border border-neutral-200 p-6 text-center">
        {isSuccess ? (
          <>
            <CheckCircle2 size={48} className="text-forest mx-auto" />
            <h1 className="font-display font-semibold text-xl mt-3 text-neutral-900">
              Pembayaran berhasil
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Paket {planName} sudah aktif. Mengalihkan...
            </p>
          </>
        ) : isExpired ? (
          <>
            <XCircle size={48} className="text-danger mx-auto" />
            <h1 className="font-display font-semibold text-xl mt-3 text-neutral-900">
              QR sudah kadaluarsa
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Buat tagihan baru untuk menyelesaikan pembayaran.
            </p>
            <Link
              href="/subscription"
              className="inline-block mt-4 rounded-xl bg-forest text-white px-4 py-2.5 text-sm font-semibold hover:bg-forest-dark"
            >
              Buat tagihan baru
            </Link>
          </>
        ) : isFailed ? (
          <>
            <XCircle size={48} className="text-danger mx-auto" />
            <h1 className="font-display font-semibold text-xl mt-3 text-neutral-900">
              Pembayaran gagal
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Silakan buat tagihan baru dari halaman Langganan.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Pembayaran QRIS
            </p>
            <h1 className="font-display font-semibold text-xl mt-1 text-neutral-900">
              Paket {planName}
            </h1>
            <p className="text-2xl font-bold text-neutral-900 mt-1">
              {formatRupiah(invoice.amount)}
              <span className="text-xs font-normal text-neutral-500">
                {" "}
                /{invoice.billing_cycle === "yearly" ? "tahun" : "bulan"}
              </span>
            </p>

            <div className="mt-5 flex justify-center">
              {invoice.qr_string ? (
                <div className="p-3 bg-white border border-neutral-200 rounded-2xl">
                  <QRCodeSVG value={invoice.qr_string} size={220} />
                </div>
              ) : (
                <div className="w-[244px] h-[244px] rounded-2xl bg-neutral-100 flex items-center justify-center text-sm text-neutral-400">
                  QR tidak tersedia
                </div>
              )}
            </div>

            <p className="text-xs text-neutral-500 mt-3">
              No. Invoice <span className="font-mono">{invoice.invoice_number}</span>
            </p>

            <div className="flex items-center justify-center gap-2 mt-3 text-sm text-amber-700">
              <Clock size={15} />
              {remaining !== null ? (
                <span>Berlaku {formatCountdown(remaining)} lagi</span>
              ) : (
                <span>Menunggu pembayaran</span>
              )}
            </div>

            <p className="text-xs text-neutral-400 mt-2">
              Scan dengan aplikasi bank/e-wallet yang mendukung QRIS. Halaman ini
              otomatis mengecek status pembayaran.
            </p>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="mt-5 w-full rounded-xl bg-forest text-white py-3 text-sm font-semibold hover:bg-forest-dark disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Mengecek..." : "Saya sudah bayar — cek status"}
            </button>
          </>
        )}
        {runtime?.simulation?.("subscription", invoice.id)}
      </div>
    </div>
  );
}
