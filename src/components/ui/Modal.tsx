"use client";

import { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";

type ModalProps = {
  children: ReactNode;
  className?: string;
  isOpen: boolean;
};

export function Modal({ children, className, isOpen }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="p-safe fixed inset-0 z-50 grid place-items-center bg-primary/35">
      <Card
        role="dialog"
        aria-modal="true"
        className={cx("w-full max-w-lg shadow-xl", className)}
      >
        {children}
      </Card>
    </div>
  );
}
