"use client";

import { useState } from "react";
import { X, Send, Mail } from "lucide-react";
import { showToast } from "@/components/shared/Toast";

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateRange: string;
}

export default function EmailReportModal({ isOpen, onClose, dateRange }: EmailReportModalProps) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

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
      onClose();
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
    <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-neutral-500" />
              <h3 className="font-display font-semibold text-base text-neutral-900">
                Kirim Laporan
              </h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600"
            >
              <X size={16} />
            </button>
          </div>

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

          <button
            onClick={handleSend}
            disabled={!email || sending}
            className="w-full bg-forest text-white rounded-xl px-6 py-3 font-semibold text-sm hover:bg-forest-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
  );
}
