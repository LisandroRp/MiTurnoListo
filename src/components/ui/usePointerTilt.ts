"use client";

import type { PointerEvent } from "react";

type PointerTiltOptions = {
  intensity?: number;
  shadow?: boolean;
  lift?: boolean;
};

export function usePointerTilt<T extends HTMLElement>({ intensity = 50, shadow = false, lift = false }: PointerTiltOptions = {}) {
  const percentage = Math.max(0, Math.min(100, Number.isFinite(intensity) ? intensity : 50));
  const maxRotation = 6 * percentage / 100;
  function onPointerMove(event: PointerEvent<T>) {
    if (event.pointerType !== "mouse") return;

    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const horizontal = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const vertical = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    if (lift) element.style.setProperty("--tilt-lift", "-4px");
    element.style.setProperty("--tilt-rotate-x", `${vertical * maxRotation}deg`);
    element.style.setProperty("--tilt-rotate-y", `${horizontal * -maxRotation}deg`);
  }

  function resetTilt(event: PointerEvent<T>) {
    event.currentTarget.style.removeProperty("--tilt-rotate-x");
    event.currentTarget.style.removeProperty("--tilt-rotate-y");
    event.currentTarget.style.removeProperty("--tilt-lift");
  }

  return {
    onPointerMove,
    onPointerLeave: resetTilt,
    onPointerCancel: resetTilt,
    className: `${shadow ? "shadow-sm hover:shadow-lg motion-safe:transition-[transform,box-shadow]" : "motion-safe:transition-transform"} motion-safe:duration-150 motion-safe:ease-out motion-safe:[transform:perspective(700px)_translateY(var(--tilt-lift,0px))_rotateX(var(--tilt-rotate-x,0deg))_rotateY(var(--tilt-rotate-y,0deg))]`
  };
}
