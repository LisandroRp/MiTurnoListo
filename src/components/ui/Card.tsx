import { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/components/ui/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cx(
        "rounded-lg border border-subtle bg-surface p-5 shadow-sm",
        typeof props.onClick === "function" ? "cursor-pointer" : "",
        className
      )}
    >
      {children}
    </div>
  );
}
