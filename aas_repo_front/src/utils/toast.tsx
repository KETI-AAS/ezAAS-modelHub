// src/utils/toast.ts
"use client";

import toast, { ToastOptions, Toast } from "react-hot-toast";
import { CheckCircle, AlertCircle, AlertTriangle, Loader2, X } from "lucide-react";

const typeConfig = {
  loading: {
    Icon: Loader2,
    color: "text-slate-600",
    bg: "bg-white border-slate-300",
    iconClass: "animate-spin text-slate-500",
  },
  success: {
    Icon: CheckCircle,
    color: "text-emerald-700",
    bg: "bg-white border-emerald-400",
    iconClass: "text-emerald-500",
  },
  warning: {
    Icon: AlertTriangle,
    color: "text-amber-700",
    bg: "bg-white border-amber-400",
    iconClass: "text-amber-500",
  },
  error: {
    Icon: AlertCircle,
    color: "text-red-700",
    bg: "bg-white border-red-400",
    iconClass: "text-red-500",
  },
};

type MessageType = keyof typeof typeConfig;

const createToast = (type: MessageType) => {
  return (message: string, options?: ToastOptions) => {
    const { Icon, color, bg, iconClass } = typeConfig[type];

    return toast.custom(
      (t: Toast) => (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all duration-300 ${bg} ${
            t.visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}
          style={{ minWidth: 280, maxWidth: 420 }}
        >
          <Icon className={`mt-0.5 size-5 shrink-0 ${iconClass}`} />
          <span className={`flex-1 text-sm font-medium ${color}`}>{message}</span>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="ml-1 shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      ),
      options
    );
  };
};

export const showToast: {
  loading: (msg: string, opt?: ToastOptions) => string;
  success: (msg: string, opt?: ToastOptions) => string;
  warning: (msg: string, opt?: ToastOptions) => string;
  error: (msg: string, opt?: ToastOptions) => string;
} = {
  loading: createToast("loading"),
  success: createToast("success"),
  warning: createToast("warning"),
  error: createToast("error"),
};
