import { cx } from "@/components/ui/utils";

type SegmentedOption<Value extends string> = {
  label: string;
  value: Value;
};

type SegmentedControlProps<Value extends string> = {
  label: string;
  onChange: (value: Value) => void;
  options: readonly SegmentedOption<Value>[];
  size?: "sm" | "md";
  variant?: "segmented" | "tabs";
  value: Value;
};

export function SegmentedControl<Value extends string>({ label, onChange, options, size = "sm", variant = "segmented", value }: SegmentedControlProps<Value>) {
  return (
    <div role="group" aria-label={label} className={variant === "tabs" ? "flex rounded-lg border border-subtle bg-surface p-1" : "flex gap-0.5 rounded-md bg-input p-0.5"}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={cx(
            "min-w-0 flex-1 cursor-pointer font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed",
            variant === "tabs" ? "rounded-lg" : "rounded-md border",
            size === "md" ? "min-h-9 px-3 text-sm" : "min-h-7 px-2 text-xs",
            variant === "segmented" ? (value === option.value ? "border-transparent" : "border-brand-soft") : "",
            value === option.value
              ? variant === "tabs" ? "bg-brand text-on-brand shadow-sm hover:bg-brand-hover" : "bg-brand-soft text-brand-strong shadow-sm"
              : "bg-surface text-muted hover:text-primary"
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
