"use client";

import Link from "next/link";
import { Sparkles, X } from "lucide-react";

interface UpgradeModalProps {
  message: string;
  onClose: () => void;
}

export default function UpgradeModal({ message, onClose }: UpgradeModalProps) {
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 text-forest flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400"
          >
            <X size={16} />
          </button>
        </div>

        <h3 className="font-display font-semibold text-lg mt-4 text-neutral-900">
          Upgrade paket
        </h3>
        <p className="text-sm text-neutral-500 mt-1.5 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl py-2.5 hover:bg-neutral-200"
          >
            Nanti
          </button>
          <Link
            href="/subscription"
            onClick={onClose}
            className="flex-1 bg-forest text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-forest-dark text-center"
          >
            Lihat paket
          </Link>
        </div>
      </div>
    </div>
  );
}
