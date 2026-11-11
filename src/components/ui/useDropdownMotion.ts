"use client";

import { type RefObject, useLayoutEffect, useState } from "react";

export type DropdownMotionVariant = "vertical" | "diagonal";
type MotionRect = Pick<DOMRect, "top" | "left" | "right" | "width" | "height">;
type DropdownMotionOptions = {
  isOpen: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  variant?: DropdownMotionVariant;
  ready?: boolean;
};

const duration = 150;
const fullClip = "inset(0px 0px 0px 0px)";

export function getDropdownMotionFrames(content: MotionRect, trigger: MotionRect, variant: DropdownMotionVariant, isOpening: boolean) {
  const height = Math.max(0, content.height);
  const top = content.top < trigger.top ? height : 0;
  const bottom = top === 0 ? height : 0;
  const width = Math.max(0, content.width);
  const left = variant === "diagonal" ? Math.min(width, Math.max(0, trigger.left - content.left)) : 0;
  const right = variant === "diagonal" ? Math.min(width - left, Math.max(0, content.right - trigger.right)) : 0;
  const collapsed = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
  return isOpening
    ? [{ opacity: 0, clipPath: collapsed }, { opacity: 1, clipPath: fullClip }]
    : [{ opacity: 1, clipPath: fullClip }, { opacity: 1, clipPath: collapsed }];
}

// Vertical motion reveals the full width; diagonal motion starts at the trigger's footprint.
// Both variants measure the current alignment again when closing.
export function useDropdownMotion({ isOpen, triggerRef, contentRef, variant = "vertical", ready = true }: DropdownMotionOptions) {
  const [isPresent, setIsPresent] = useState(isOpen);
  if (isOpen && !isPresent) setIsPresent(true);

  useLayoutEffect(() => {
    if ((!isOpen && !isPresent) || (isOpen && !ready)) return;
    const content = contentRef.current;
    const trigger = triggerRef.current;
    if (!content || !trigger) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let animation: Animation | undefined;
    let frame: number | undefined;
    let timeout: number | undefined;
    const previousOpacity = content.style.opacity;
    const finish = () => { if (!cancelled) setIsPresent(false); };

    function animate(isOpening: boolean) {
      if (cancelled || !content || !trigger) return;
      animation = content.animate?.(
        getDropdownMotionFrames(content.getBoundingClientRect(), trigger.getBoundingClientRect(), variant, isOpening),
        { duration, easing: isOpening ? "ease-out" : "ease-in", fill: "forwards" }
      );
      if (isOpening) {
        if (!animation) content.style.opacity = previousOpacity;
        void animation?.finished.then(() => {
          if (cancelled) return;
          content.style.opacity = previousOpacity;
          animation?.cancel();
        }, () => {});
      } else {
        timeout = window.setTimeout(finish, duration);
        void animation?.finished.then(finish, () => {});
      }
    }

    if (isOpen && !reducedMotion) {
      content.style.opacity = "0";
      // Read geometry after the caller has positioned its panel in layout effects.
      frame = window.requestAnimationFrame(() => animate(true));
    } else if (!isOpen) {
      if (reducedMotion) timeout = window.setTimeout(finish, 0);
      else animate(false);
    }

    return () => {
      cancelled = true;
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (timeout !== undefined) window.clearTimeout(timeout);
      animation?.cancel();
      content.style.opacity = previousOpacity;
    };
  }, [isOpen, isPresent, ready, variant, triggerRef, contentRef]);

  return { isPresent: isOpen || isPresent };
}
