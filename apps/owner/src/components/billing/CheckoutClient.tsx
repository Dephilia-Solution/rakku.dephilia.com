"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { showToast } from "@rakku/ui";
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
  const router = useRouter();
  const [status, setStatus] = useState(invoice.status);
  const [now, setNow] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/owner/subscription/invoices/${invoice.id}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.invoice?.status ?? "pending");
      if (data.invoice?.status === "success") {
        showToast("success", "Pembayaran berhasil! Paket diaktifkan.");
        setTimeout(() => router.push("/subscription"), 1200);
      }
    } catch {
      // diamkan, coba lagi di polling berikutnya
    }
  }, [invoice.id, router]);

  useEffect(() => {
    if (status !== "pending") return;
    const poll = setInterval(refresh, 5000);
    return () => clearInterval(poll);
  }, [status, refresh]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/owner/subscription/invoices/${invoice.id}/sync`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error || "Gagal cek status");
        return;
      }
      setStatus(data.invoice?.status ?? "pending");
      if (data.invoice?.status === "success") {
        showToast("success", "Pembayaran berhasil! Paket diaktifkan.");
        setTimeout(() => router.push("/subscription"), 1200);
      } else {
        showToast("info", "Pembayaran belum terdeteksi. Coba lagi sebentar.");
      }
    } catch {
      showToast("error", "Terjadi kesalahan, coba lagi");
    } finally {
      setSyncing(false);
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
      </div>
    </div>
  );
}
