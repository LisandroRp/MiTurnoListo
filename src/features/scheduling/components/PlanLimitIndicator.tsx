import { Button } from "@/components/ui/Button";

type PlanLimitIndicatorProps = { label: string; onClick: () => void };

export function PlanLimitIndicator({ label, onClick }: PlanLimitIndicatorProps) {
  return <Button variant="secondary" size="sm" className="w-fit !border-brand-strong text-xs uppercase tracking-[0.18em] !text-brand-strong shadow-sm" onClick={onClick}>{label}</Button>;
}
