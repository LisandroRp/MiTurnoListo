"use client";

import type { PointerEvent } from "react";

export function usePointerTilt<T extends HTMLElement>(maxRotation = 3) {
  function onPointerMove(event: PointerEvent<T>) {
    if (event.pointerType !== "mouse") return;

    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const horizontal = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const vertical = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    element.style.setProperty("--tilt-rotate-x", `${vertical * maxRotation}deg`);
    element.style.setProperty("--tilt-rotate-y", `${horizontal * -maxRotation}deg`);
  }

  function resetTilt(event: PointerEvent<T>) {
    event.currentTarget.style.removeProperty("--tilt-rotate-x");
    event.currentTarget.style.removeProperty("--tilt-rotate-y");
  }

  return {
    onPointerMove,
    onPointerLeave: resetTilt,
    onPointerCancel: resetTilt,
    className: "motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:[transform:perspective(700px)_rotateX(var(--tilt-rotate-x,0deg))_rotateY(var(--tilt-rotate-y,0deg))]"
  };
}
