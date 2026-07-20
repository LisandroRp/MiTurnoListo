"use client";

import Link from "next/link";
import { FiLock } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

type PremiumFeatureCardProps = {
  actionLabel: string;
  badge: string;
  description: string;
  href?: string;
  title: string;
};

export function PremiumFeatureCard({
  actionLabel,
  badge,
  description,
  href = "/perfil#planes",
  title
}: PremiumFeatureCardProps) {
  return (
    <Card className="grid w-full max-w-lg justify-items-center gap-4 border-brand bg-surface text-center shadow-xl ring-2 ring-brand/20">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-xl text-brand-strong">
        <FiLock aria-hidden="true" />
      </span>
      <div>
        <Badge tone="brand">{badge}</Badge>
        <h2 className="mt-3 text-2xl font-bold text-primary">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      </div>
      <Link
        href={href}
        className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
      >
        {actionLabel}
      </Link>
    </Card>
  );
}
