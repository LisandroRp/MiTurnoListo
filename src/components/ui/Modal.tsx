"use client";

import { cloneElement, ReactElement, ReactNode, useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";

const modalFadeDuration = 150;
let scrollLockCount = 0;
let previousBodyOverflow = "";

export function getModalFadeDuration() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : modalFadeDuration;
}

function useModalPresence(isOpen: boolean) {
  const [isPresent, setIsPresent] = useState(isOpen);
  if (isOpen && !isPresent) setIsPresent(true);

  useEffect(() => {
    if (isOpen || !isPresent) return;
    const timeout = window.setTimeout(() => setIsPresent(false), getModalFadeDuration());
    return () => window.clearTimeout(timeout);
  }, [isOpen, isPresent]);

  return isOpen || isPresent;
}

// Keep conditionally rendered modal components mounted until their exit fade ends.
export function ModalPresence({ children }: { children: ReactElement<{ isOpen?: boolean }> | null }) {
  const [lastChild, setLastChild] = useState(children);
  const isOpen = children !== null;
  const isPresent = useModalPresence(isOpen);
  if (isOpen && lastChild !== children) setLastChild(children);
  if (!isPresent) {
    if (lastChild !== null) setLastChild(null);
    return null;
  }
  const child = children ?? lastChild;
  return child ? cloneElement(child, { isOpen }) : null;
}

type ModalProps = {
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  isOpen: boolean;
};

export function Modal({ children, className, overlayClassName, isOpen }: ModalProps) {
  const isPresent = useModalPresence(isOpen);
  const [lastContent, setLastContent] = useState<ReactNode>(null);
  if (isOpen && lastContent !== children) setLastContent(children);
  if (!isPresent && lastContent !== null) setLastContent(null);

  useEffect(() => {
    if (!isPresent) return;
    if (scrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    scrollLockCount += 1;
    return () => {
      scrollLockCount -= 1;
      if (scrollLockCount === 0) document.body.style.overflow = previousBodyOverflow;
    };
  }, [isPresent]);

  if (!isPresent) return null;

  return (
    <div
      inert={!isOpen}
      aria-hidden={!isOpen || undefined}
      className={cx(
        "p-safe fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-primary/35 motion-reduce:animate-none",
        isOpen ? "animate-[modal-fade-in_150ms_ease-out]" : "pointer-events-none animate-[modal-fade-out_150ms_ease-out_forwards] opacity-0",
        overlayClassName
      )}
    >
      <Card
        role="dialog"
        aria-modal="true"
        className={cx("pb-safe-6 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto shadow-xl", className)}
      >
        {isOpen ? children : lastContent}
      </Card>
    </div>
  );
}
