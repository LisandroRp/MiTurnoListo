import { useEffect } from "react";
import { FiAlertTriangle, FiCheckCircle, FiXCircle, FiX } from "react-icons/fi";

import { cx } from "@/components/ui/utils";

export type ToastTone = "success" | "warning" | "error";

export type ToastMessage = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
};

type ToastProps = {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
};

const toneClasses: Record<ToastMessage["tone"], string> = {
  success: "border-success bg-success-soft text-success",
  warning: "border-warning bg-warning-soft text-warning",
  error: "border-danger bg-danger-soft text-danger"
};

const toneIcons: Record<ToastMessage["tone"], typeof FiCheckCircle> = {
  success: FiCheckCircle,
  warning: FiAlertTriangle,
  error: FiXCircle
};

const toastDurationMs = 4000;

export function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = toneIcons[toast.tone];
  const hasDescription = Boolean(toast.description);

  useEffect(() => {
    const dismissTimer = window.setTimeout(() => {
      onDismiss(toast.id);
    }, toastDurationMs);

    return () => {
      window.clearTimeout(dismissTimer);
    };
  }, [onDismiss, toast.id]);

  return (
    <div
      className={cx(
        "flex w-full max-w-xs gap-3 rounded-lg border px-4 py-3 shadow-lg",
        hasDescription ? "items-start" : "items-center",
        toneClasses[toast.tone]
      )}
    >
      <Icon className={cx("shrink-0 text-lg", hasDescription ? "mt-0.5" : "")} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.95rem] font-bold leading-5">{toast.title}</p>
        {toast.description ? <p className="mt-1 text-sm opacity-85">{toast.description}</p> : null}
      </div>
      <button
        type="button"
        aria-label="Close notification"
        className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full text-current opacity-70 transition hover:bg-surface hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        onClick={() => onDismiss(toast.id)}
      >
        <FiX className="text-base" aria-hidden="true" />
      </button>
    </div>
  );
}

type ToastViewportProps = {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
};

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 grid w-[calc(100vw-2rem)] justify-items-end gap-3 sm:w-auto">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
