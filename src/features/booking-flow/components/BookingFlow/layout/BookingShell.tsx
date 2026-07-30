import { ReactNode } from "react";

import { cx } from "@/components/ui/utils";

export function BookingShell({
  children,
  className,
  theme = "coral",
  mode = "public"
}: {
  children: ReactNode;
  className?: string;
  theme?: string;
  mode?: "public" | "preview";
}) {
  return (
    <main className={cx(
      `theme-${theme} text-primary`,
      mode === "public" ? "min-h-screen bg-page px-4 py-8 sm:px-6 lg:px-8" : "bg-transparent"
    )}>
      <div className={cx("mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6", className)}>{children}</div>
    </main>
  );
}
