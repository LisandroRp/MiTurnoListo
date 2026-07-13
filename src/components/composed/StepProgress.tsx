import { cx } from "@/components/ui/utils";

type StepProgressItem = {
  id: string;
  label: string;
};

type StepProgressProps = {
  steps: StepProgressItem[];
  currentStepIndex: number;
  onStepSelect?: (index: number) => void;
};

export function StepProgress({ steps, currentStepIndex, onStepSelect }: StepProgressProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {steps.map((step, index) => {
        const isAvailable = index <= currentStepIndex;
        const isCurrent = index === currentStepIndex;

        return (
          <button
            key={step.id}
            type="button"
            disabled={!isAvailable || !onStepSelect}
            onClick={() => onStepSelect?.(index)}
            className={cx(
              "rounded-lg border p-3 text-left transition-all",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              isAvailable && onStepSelect ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm" : "cursor-not-allowed opacity-60",
              isCurrent ? "border-brand bg-brand-soft text-brand-strong" : "border-subtle bg-sidebar text-muted",
              isAvailable && !isCurrent ? "bg-surface text-primary" : ""
            )}
            aria-current={isCurrent ? "step" : undefined}
          >
            <p className="text-xs font-bold uppercase">0{index + 1}</p>
            <p className="mt-1 text-sm font-semibold">{step.label}</p>
          </button>
        );
      })}
    </div>
  );
}
