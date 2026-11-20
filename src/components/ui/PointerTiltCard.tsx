"use client";

import type { ComponentProps } from "react";

import { Card } from "@/components/ui/Card";
import { usePointerTilt } from "@/components/ui/usePointerTilt";
import { cx } from "@/components/ui/utils";

type PointerTiltCardProps = ComponentProps<typeof Card> & {
  intensity?: number;
};

export function PointerTiltCard({ className, intensity = 50, onPointerMove, onPointerLeave, onPointerCancel, ...props }: PointerTiltCardProps) {
  const tilt = usePointerTilt<HTMLDivElement>({ intensity, shadow: true, lift: true });

  return (
    <Card
      {...props}
      className={cx(tilt.className, className)}
      onPointerMove={(event) => { tilt.onPointerMove(event); onPointerMove?.(event); }}
      onPointerLeave={(event) => { tilt.onPointerLeave(event); onPointerLeave?.(event); }}
      onPointerCancel={(event) => { tilt.onPointerCancel(event); onPointerCancel?.(event); }}
    />
  );
}
