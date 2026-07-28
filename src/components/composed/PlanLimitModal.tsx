"use client";

import Link from "next/link";
import { FiLock, FiX } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type PlanLimitModalProps = {
  actionLabel: string;
  badge: string;
  description: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
};

export function PlanLimitModal({
  actionLabel,
  badge,
  description,
  isOpen,
  onClose,
  title
}: PlanLimitModalProps) {
  return (
    <Modal isOpen={isOpen}>
      <div className="grid gap-5 text-center">
        <div className="relative flex items-start justify-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-xl text-brand-strong">
            <FiLock aria-hidden="true" />
          </span>
          <Button className="absolute right-0" variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}>
            <FiX aria-hidden="true" />
          </Button>
        </div>

        <div>
          <Badge tone="brand">{badge}</Badge>
          <h2 className="mt-3 text-2xl font-bold text-primary">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        </div>

        <Link
          href="/perfil#planes"
          onClick={onClose}
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
        >
          {actionLabel}
        </Link>
      </div>
    </Modal>
  );
}
