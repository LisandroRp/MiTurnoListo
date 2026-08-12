"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const switchToBottomThresholdPx = 16;
const switchToTopThresholdPx = 72;

export function useDualActionVisibility() {
  const [topElement, setTopElement] = useState<HTMLDivElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const topRef = useCallback((element: HTMLDivElement | null) => {
    setTopElement(element);
  }, []);
  const bottomRef = useCallback(() => undefined, []);

  useEffect(() => {
    if (!topElement) {
      return;
    }

    const observedTopElement = topElement;

    function updatePlacement() {
      const topBounds = observedTopElement.getBoundingClientRect();

      setPlacement((current) => {
        if (current === "top" && topBounds.bottom < switchToBottomThresholdPx) {
          return "bottom";
        }

        if (current === "bottom" && topBounds.bottom > switchToTopThresholdPx) {
          return "top";
        }

        return current;
      });
    }

    function schedulePlacementUpdate() {
      if (animationFrameId.current !== null) {
        return;
      }

      animationFrameId.current = window.requestAnimationFrame(() => {
        animationFrameId.current = null;
        updatePlacement();
      });
    }

    updatePlacement();
    window.addEventListener("scroll", schedulePlacementUpdate, { passive: true });
    window.addEventListener("resize", schedulePlacementUpdate);

    return () => {
      window.removeEventListener("scroll", schedulePlacementUpdate);
      window.removeEventListener("resize", schedulePlacementUpdate);

      if (animationFrameId.current !== null) {
        window.cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [topElement]);

  return {
    topRef,
    bottomRef,
    showTopActions: placement === "top",
    showBottomActions: placement === "bottom"
  };
}
