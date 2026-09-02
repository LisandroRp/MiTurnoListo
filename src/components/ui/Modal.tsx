"use client";

import { ReactNode, useEffect } from "react";

import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";

type ModalProps = {
  children: ReactNode;
  className?: string;
  isOpen: boolean;
};

export function Modal({ children, className, isOpen }: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="p-safe fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-primary/35">
      <Card
        role="dialog"
        aria-modal="true"
        className={cx("pb-safe-6 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto shadow-xl", className)}
      >
        {children}
      </Card>
    </div>
  );
}
