"use client";

import { useModalHistory } from "@/hooks/useModalHistory";
import { X, AlertTriangle, Trash2 } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Hapus",
  cancelText = "Batal",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  const { handleCloseAndPop } = useModalHistory(isOpen, onClose);

  if (!isOpen) return null;

  const confirmStyle =
    variant === "danger"
      ? "bg-red-500 text-white hover:bg-red-600"
      : "bg-amber-500 text-white hover:bg-amber-600";

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm overflow-y-auto overscroll-contain" onClick={handleCloseAndPop}>
      <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
        <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-md w-full sm:max-w-sm mobile-slide-up pb-safe sm:pb-0 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-neutral-300" />
          </div>

          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-200">
            <h3 className="font-display font-semibold text-base text-neutral-900">
              {title}
            </h3>
            <button onClick={handleCloseAndPop} className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600">
              <X size={18} />
            </button>
          </div>

          <div className="px-4 sm:px-6 py-6 flex flex-col items-center text-center space-y-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${variant === "danger" ? "bg-red-100" : "bg-amber-100"}`}>
              {variant === "danger" ? (
                <Trash2 size={24} className="text-red-500" />
              ) : (
                <AlertTriangle size={24} className="text-amber-500" />
              )}
            </div>
            <p className="text-sm text-neutral-600">{message}</p>
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-neutral-200 bg-white flex gap-2">
            <button
              onClick={handleCloseAndPop}
              className="flex-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl py-3 hover:bg-neutral-200 transition-colors active:scale-[0.98]"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${confirmStyle}`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
