import { SelectHTMLAttributes } from "react";
import { FiChevronDown } from "react-icons/fi";

import { cx } from "@/components/ui/utils";

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: SelectOption[];
};

export function SelectField({ label, options, className, id, ...props }: SelectFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="grid gap-2 text-sm font-medium text-primary" htmlFor={fieldId}>
      {label ? (
        <span>
          {label}
          {props.required ? <span className="ml-1 text-danger">*</span> : null}
        </span>
      ) : null}
      <span className="relative">
        <select
          {...props}
          id={fieldId}
          className={cx(
            "h-11 w-full cursor-pointer appearance-none rounded-lg border border-subtle bg-input px-3 pr-10 text-sm text-primary outline-none transition-colors",
            "focus:border-brand focus:ring-2 focus:ring-focus",
            className
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-muted" aria-hidden="true" />
      </span>
    </label>
  );
}
