import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cx } from "@/components/ui/utils";

type FloatingInfoPopoverProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  content: ReactNode;
};

type PopoverPosition = {
  left: number;
  top: number;
};

const popoverWidth = 256;
const popoverGap = 10;
const viewportPadding = 12;

export function FloatingInfoPopover({ ariaLabel, children, className, content }: FloatingInfoPopoverProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;

      if (!trigger) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const popoverHeight = popoverRef.current?.offsetHeight ?? 0;
      const availableBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
      const shouldOpenAbove = popoverHeight > 0 && availableBelow < popoverHeight + popoverGap;
      const nextTop = shouldOpenAbove
        ? triggerRect.top - popoverHeight - popoverGap
        : triggerRect.bottom + popoverGap;
      const centeredLeft = triggerRect.left + triggerRect.width / 2 - popoverWidth / 2;

      setPosition({
        left: Math.min(Math.max(centeredLeft, viewportPadding), window.innerWidth - popoverWidth - viewportPadding),
        top: Math.max(viewportPadding, nextTop)
      });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        aria-label={ariaLabel}
        onBlur={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {children}
      </button>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="tooltip"
              className={cx(
                "pointer-events-none fixed z-50 w-64 rounded-lg border border-subtle bg-surface p-3 text-left text-xs leading-5 text-muted shadow-lg",
                !position && "opacity-0"
              )}
              style={position ?? { left: 0, top: 0 }}
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
