import { ReactNode } from "react";

import { PremiumFeatureCard } from "@/components/composed/PremiumFeatureCard";
import { Card } from "@/components/ui/Card";
import { AnalyticsPanel } from "@/features/scheduling/components/StatisticsView/AnalyticsPanel";
import { Messages } from "@/features/scheduling/i18n/messages";

type StatisticsPanelProps = {
  title: string;
  description: string;
  controls: Messages["statistics"];
  isLocked: boolean;
  expandable?: boolean;
  children: ReactNode | ((isExpanded: boolean) => ReactNode);
};

export function StatisticsPanel({ title, description, controls, isLocked, expandable = true, children }: StatisticsPanelProps) {
  if (!isLocked) {
    return expandable ? (
      <AnalyticsPanel title={title} description={description} controls={controls}>{children}</AnalyticsPanel>
    ) : <>{typeof children === "function" ? children(false) : children}</>;
  }

  return (
    <div className="relative flex min-h-[28rem] min-w-0 items-center justify-center">
      <Card aria-hidden="true" className="pointer-events-none absolute inset-0 select-none overflow-hidden blur-sm">
        <div className="h-5 w-2/3 rounded bg-surface-strong" />
        <div className="mt-3 h-3 w-1/2 rounded bg-surface-strong" />
        <div className="mt-8 grid gap-6">
          {["w-3/4", "w-1/2", "w-2/3"].map((width) => (
            <div key={width} className="grid gap-3">
              <div className="h-3 w-1/3 rounded bg-surface-strong" />
              <div className={`h-5 rounded bg-brand-soft ${width}`} />
            </div>
          ))}
        </div>
      </Card>
      <div className="relative z-10 grid w-full place-items-center p-4">
        <PremiumFeatureCard
          badge={controls.advancedLockedBadge}
          title={title}
          description={`${description} ${controls.advancedLockedDescription}`}
          actionLabel={controls.advancedLockedAction}
        />
      </div>
    </div>
  );
}
