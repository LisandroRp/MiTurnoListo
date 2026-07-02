import { SelectHTMLAttributes } from "react";

import { cx } from "@/components/ui/utils";

type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: SelectOption[];
};

export function SelectField({ label, options, className, id, ...props }: SelectFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="grid gap-2 text-sm font-medium text-primary" htmlFor={fieldId}>
      {label}
      <select
        {...props}
        id={fieldId}
        className={cx(
          "h-11 w-full cursor-pointer rounded-lg border border-subtle bg-input px-3 text-sm text-primary outline-none transition-colors",
          "focus:border-brand focus:ring-2 focus:ring-focus",
          className
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
