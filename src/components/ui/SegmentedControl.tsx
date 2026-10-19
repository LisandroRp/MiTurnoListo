import { cx } from "@/components/ui/utils";

type SegmentedOption<Value extends string> = {
  label: string;
  value: Value;
};

type SegmentedControlProps<Value extends string> = {
  label: string;
  onChange: (value: Value) => void;
  options: readonly SegmentedOption<Value>[];
  value: Value;
};

export function SegmentedControl<Value extends string>({ label, onChange, options, value }: SegmentedControlProps<Value>) {
  return (
    <div role="group" aria-label={label} className="flex gap-0.5 rounded-md bg-input p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={cx(
            "min-h-7 min-w-0 flex-1 rounded-md px-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            value === option.value ? "bg-brand-soft text-brand-strong shadow-sm" : "text-muted hover:bg-surface hover:text-primary"
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
