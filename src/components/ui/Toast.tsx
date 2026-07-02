import { FiAlertTriangle, FiCheckCircle, FiXCircle, FiX } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
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

export function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = toneIcons[toast.tone];

  return (
    <div className={cx("flex w-full max-w-sm gap-3 rounded-lg border p-4 shadow-lg", toneClasses[toast.tone])}>
      <Icon className="mt-0.5 shrink-0 text-lg" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{toast.title}</p>
        {toast.description ? <p className="mt-1 text-sm opacity-85">{toast.description}</p> : null}
      </div>
      <Button
        aria-label="Close notification"
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-current hover:bg-surface"
        onClick={() => onDismiss(toast.id)}
      >
        <FiX />
      </Button>
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
