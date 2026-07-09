"use client";

import { useState } from "react";
import { X, Send, Mail } from "lucide-react";
import { showToast } from "@rakku/ui";
import { useModalHistory } from "@/hooks/useModalHistory";

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateRange: string;
}

export default function EmailReportModal({ isOpen, onClose, dateRange }: EmailReportModalProps) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const { handleCloseAndPop } = useModalHistory(isOpen, onClose);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!email.includes("@")) {
      showToast("error", "Email tidak valid");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/reports/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, dateRange }),
      });
      if (!res.ok) throw new Error();
      showToast("success", "Laporan berhasil dikirim!");
      setEmail("");
      handleCloseAndPop();
    } catch {
      showToast("error", "Gagal mengirim email. Periksa konfigurasi email.");
    } finally {
      setSending(false);
    }
  };

  const rangeLabel =
    dateRange === "today" ? "Hari Ini"
    : dateRange === "yesterday" ? "Kemarin"
    : dateRange === "week" ? "7 Hari Terakhir"
    : "Semua Waktu";

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={handleCloseAndPop}>
      <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
        <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-md w-full sm:max-w-sm mobile-slide-up pb-safe sm:pb-0 max-h-[90dvh] sm:max-h-none overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-neutral-300" />
          </div>

          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-neutral-500" />
              <h3 className="font-display font-semibold text-base text-neutral-900">
                Kirim Laporan
              </h3>
            </div>
            <button
              onClick={handleCloseAndPop}
              className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600 active:scale-95 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-4 sm:px-6 py-4 flex-1">
            <p className="text-sm text-neutral-600 mb-4">
              Laporan periode <span className="font-medium text-neutral-900">{rangeLabel}</span> akan dikirim ke email:
            </p>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contoh@email.com"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest mb-4"
            />
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-neutral-200 bg-white">
            <button
              onClick={handleSend}
              disabled={!email || sending}
              className="w-full bg-forest text-white rounded-xl py-3.5 font-semibold text-sm hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send size={15} />
                  Kirim Laporan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
