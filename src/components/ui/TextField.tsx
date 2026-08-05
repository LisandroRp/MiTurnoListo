import { InputHTMLAttributes, ReactNode } from "react";

import { cx } from "@/components/ui/utils";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  label: string;
  helperText?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function TextField({ label, helperText, prefix, suffix, className, id, ...props }: TextFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="grid gap-2 text-sm font-medium text-primary" htmlFor={fieldId}>
      <span>
        {label}
        {props.required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      <span className="relative">
        {prefix ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">{prefix}</span> : null}
        <input
          {...props}
          id={fieldId}
          className={cx(
            "h-11 w-full rounded-lg border border-subtle bg-input px-3 text-sm text-primary outline-none transition-colors",
            "placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-focus",
            prefix ? "pl-9" : "",
            suffix ? "pr-11" : "",
            className
          )}
        />
        {suffix ? <span className="absolute right-2 top-1/2 -translate-y-1/2">{suffix}</span> : null}
      </span>
      {helperText ? <span className="text-xs font-normal text-muted">{helperText}</span> : null}
    </label>
  );
}
