import { Ref, TextareaHTMLAttributes } from "react";

import { cx } from "@/components/ui/utils";

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  helperText?: string;
  ref?: Ref<HTMLTextAreaElement>;
};

export function TextAreaField({ label, helperText, className, id, ...props }: TextAreaFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="grid gap-2 text-sm font-medium text-primary" htmlFor={fieldId}>
      <span>
        {label}
        {props.required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      <textarea
        {...props}
        id={fieldId}
        aria-describedby={[props["aria-describedby"], helperText && fieldId ? `${fieldId}-hint` : undefined].filter(Boolean).join(" ") || undefined}
        className={cx(
          "min-h-24 w-full resize-y rounded-lg border border-subtle bg-input px-3 py-3 text-sm text-primary outline-none transition-colors",
          "placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-focus",
          className
        )}
      />
      {helperText ? <span id={fieldId ? `${fieldId}-hint` : undefined} className="text-xs font-normal text-muted">{helperText}</span> : null}
    </label>
  );
}
