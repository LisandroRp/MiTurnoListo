import { ReactNode } from "react";

import { Card } from "@/components/ui/Card";

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-subtle pb-3 last:border-b-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold text-primary">{value}</span>
    </div>
  );
}

export function SidebarItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-brand-strong">{icon}</span>
      <div>
        <p className="text-xs font-bold uppercase text-muted">{label}</p>
        <p className="mt-1 font-semibold text-primary">{value}</p>
      </div>
    </div>
  );
}

export function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-subtle bg-input p-4">
      <p className="whitespace-nowrap text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-2 text-base font-semibold text-primary">{value}</p>
    </div>
  );
}

export function StateCard({ title, description }: { title: string; description?: string }) {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <h1 className="text-2xl font-bold text-primary">{title}</h1>
      {description ? <p className="mt-3 text-sm leading-6 text-muted">{description}</p> : null}
    </Card>
  );
}
