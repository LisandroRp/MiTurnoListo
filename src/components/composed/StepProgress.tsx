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
    <div className="flex w-full gap-2 lg:gap-3">
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
              "h-auto min-w-0 rounded-lg border transition-all lg:h-auto lg:flex-1 lg:p-3 lg:text-left",
              isCurrent ? "flex-[2_1_0] p-2 lg:flex-1" : "flex-1 p-0",
              "grid place-items-center lg:block lg:place-items-start",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              isAvailable && onStepSelect ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm" : "cursor-not-allowed opacity-60",
              isCurrent ? "border-brand bg-brand-soft text-brand-strong" : "border-subtle bg-sidebar text-muted",
              isAvailable && !isCurrent ? "bg-surface text-primary" : ""
            )}
            aria-current={isCurrent ? "step" : undefined}
          >
            <p className="text-xs font-bold uppercase">0{index + 1}</p>
            <p className={cx("mt-1 text-sm font-semibold", isCurrent ? "" : "hidden lg:block")}>{step.label}</p>
          </button>
        );
      })}
    </div>
  );
}
