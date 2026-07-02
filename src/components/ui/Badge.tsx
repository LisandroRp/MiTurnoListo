import { ReactNode } from "react";

import { cx } from "@/components/ui/utils";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "brand";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-strong",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  brand: "bg-brand-soft text-brand-strong"
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", toneClasses[tone], className)}>
      {children}
    </span>
  );
}
