import { ReactNode, Ref } from "react";

import { cx } from "@/components/ui/utils";

type DualActionSlotProps = {
  children: ReactNode;
  isVisible: boolean;
  ref?: Ref<HTMLDivElement>;
};

export function DualActionSlot({ children, isVisible, ref }: DualActionSlotProps) {
  return (
    <div
      ref={ref}
      aria-hidden={!isVisible}
      inert={!isVisible}
      className={cx(
        "transition duration-200 ease-out",
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none select-none translate-y-1 opacity-0"
      )}
    >
      {children}
    </div>
  );
}
