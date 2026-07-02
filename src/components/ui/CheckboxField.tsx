import { InputHTMLAttributes } from "react";

import { cx } from "@/components/ui/utils";

type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  helperText?: string;
};

export function CheckboxField({ label, helperText, className, id, ...props }: CheckboxFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <label className={cx("flex cursor-pointer gap-3 rounded-lg border border-subtle bg-input p-3 text-sm text-primary", className)} htmlFor={fieldId}>
      <input
        {...props}
        id={fieldId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 cursor-pointer accent-brand"
      />
      <span className="grid gap-1">
        <span className="font-semibold">{label}</span>
        {helperText ? <span className="text-xs text-muted">{helperText}</span> : null}
      </span>
    </label>
  );
}
