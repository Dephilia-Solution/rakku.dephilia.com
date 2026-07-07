"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastData {
  id: string;
  type: ToastType;
  message: string;
}

let toastListeners: ((toast: ToastData) => void)[] = [];

export function showToast(type: ToastType, message: string) {
  const toast: ToastData = { id: Date.now().toString(), type, message };
  toastListeners.forEach((fn) => fn(toast));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const listener = (toast: ToastData) => {
      setToasts((prev) => [...prev.slice(-2), toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3000);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  const icons = {
    success: <CheckCircle size={18} className="text-success" />,
    error: <XCircle size={18} className="text-danger" />,
    info: <Info size={18} className="text-forest" />,
  };

  const borders = {
    success: "border-l-success",
    error: "border-l-danger",
    info: "border-l-forest",
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 bg-white rounded-xl shadow-md px-4 py-3 min-w-[280px] border-l-4 ${borders[toast.type]} animate-slide-up`}
        >
          {icons[toast.type]}
          <span className="text-sm text-neutral-900 flex-1">{toast.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
